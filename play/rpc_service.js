/*jslint node: true */

/*
	Accept commands via JSON-RPC API.
	The daemon listens on port 6332 by default.
	See https://github.com/byteball/headless-byteball/wiki/Running-RPC-service for detailed description of the API
*/

"use strict";
var headlessWallet = require('../start.js');
var conf = require('byteballcore/conf.js');
var eventBus = require('byteballcore/event_bus.js');
var db = require('byteballcore/db.js');
var mutex = require('byteballcore/mutex.js');
var storage = require('byteballcore/storage.js');
var constants = require('byteballcore/constants.js');
var validationUtils = require("byteballcore/validation_utils.js");
var wallet_id;

if (conf.bSingleAddress)
	throw Error('can`t run in single address mode');

function initRPC() {
	var composer = require('byteballcore/composer.js');
	var network = require('byteballcore/network.js');

	var rpc = require('json-rpc2');
	var walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
	var Wallet = require('byteballcore/wallet.js');
	var balances = require('byteballcore/balances.js');

	var server = rpc.Server.$create({
		'websocket': true, // is true by default 
		'headers': { // allow custom headers is empty by default 
			'Access-Control-Allow-Origin': '*'
		}
	});

	/**
	 * Returns information about the current state.
	 * @return { last_mci: {Integer}, last_stable_mci: {Integer}, count_unhandled: {Integer} }
	 */
	server.expose('getinfo', function (args, opt, cb) {
		var response = {};
		storage.readLastMainChainIndex(function (last_mci) {
			response.last_mci = last_mci;
			storage.readLastStableMcIndex(db, function (last_stable_mci) {
				response.last_stable_mci = last_stable_mci;
				db.query("SELECT COUNT(*) AS count_unhandled FROM unhandled_joints", function (rows) {
					response.count_unhandled = rows[0].count_unhandled;
					cb(null, response);
				});
			});
		});
	});

	/**
	 * Validates address.
	 * @return {boolean} is_valid
	 */
	server.expose('validateaddress', function (args, opt, cb) {
		var address = args[0];
		cb(null, validationUtils.isValidAddress(address));
	});

	// alias for validateaddress
	server.expose('verifyaddress', function (args, opt, cb) {
		var address = args[0];
		cb(null, validationUtils.isValidAddress(address));
	});

	/**
	 * Creates and returns new wallet address.
	 * @return {String} address
	 */
	server.expose('getnewaddress', function (args, opt, cb) {
		mutex.lock(['rpc_getnewaddress'], function (unlock) {
			walletDefinedByKeys.issueNextAddress(wallet_id, 0, function (addressInfo) {
				unlock();
				cb(null, addressInfo.address);
			});
		});
	});

	/**
	 * Returns address balance(stable and pending).
	 * If address is invalid, then returns "invalid address".
	 * If your wallet doesn`t own the address, then returns "address not found".
	 * @param {String} address
	 * @return {"base":{"stable":{Integer},"pending":{Integer}}} balance
	 *
	 * If no address supplied, returns wallet balance(stable and pending).
	 * @return {"base":{"stable":{Integer},"pending":{Integer}}} balance
	 */
	server.expose('getbalance', function (args, opt, cb) {
		let start_time = Date.now();
		var address = args[0];
		var asset = args[1];
		if (address) {
			if (validationUtils.isValidAddress(address))
				db.query("SELECT COUNT(*) AS count FROM my_addresses WHERE address = ?", [address], function (rows) {
					if (rows[0].count)
						db.query(
							"SELECT asset, is_stable, SUM(amount) AS balance \n\
							FROM outputs JOIN units USING(unit) \n\
							WHERE is_spent=0 AND address=? AND sequence='good' AND asset " + (asset ? "=" + db.escape(asset) : "IS NULL") + " \n\
							GROUP BY is_stable", [address],
							function (rows) {
								var balance = {};
								balance[asset || 'base'] = {
									stable: 0,
									pending: 0
								};
								for (var i = 0; i < rows.length; i++) {
									var row = rows[i];
									balance[asset || 'base'][row.is_stable ? 'stable' : 'pending'] = row.balance;
								}
								cb(null, balance);
							}
						);
					else
						cb("address not found");
				});
			else
				cb("invalid address");
		}
		else
			Wallet.readBalance(wallet_id, function (balances) {
				console.log('getbalance took ' + (Date.now() - start_time) + 'ms');
				cb(null, balances);
			});
	});

	/**
	 * Returns wallet balance(stable and pending) without commissions earned from headers and witnessing.
	 *
	 * @return {"base":{"stable":{Integer},"pending":{Integer}}} balance
	 */
	server.expose('getmainbalance', function (args, opt, cb) {
		let start_time = Date.now();
		balances.readOutputsBalance(wallet_id, function (balances) {
			console.log('getmainbalance took ' + (Date.now() - start_time) + 'ms');
			cb(null, balances);
		});
	});

	/**
	 * Returns transaction list.
	 * If address is invalid, then returns "invalid address".
	 * @param {String} address or {since_mci: {Integer}, unit: {String}}
	 * @return [{"action":{'invalid','received','sent','moved'},"amount":{Integer},"my_address":{String},"arrPayerAddresses":[{String}],"confirmations":{0,1},"unit":{String},"fee":{Integer},"time":{String},"level":{Integer},"asset":{String}}] transactions
	 *
	 * If no address supplied, returns wallet transaction list.
	 * @return [{"action":{'invalid','received','sent','moved'},"amount":{Integer},"my_address":{String},"arrPayerAddresses":[{String}],"confirmations":{0,1},"unit":{String},"fee":{Integer},"time":{String},"level":{Integer},"asset":{String}}] transactions
	 */
	server.expose('listtransactions', function (args, opt, cb) {
		let start_time = Date.now();
		if (Array.isArray(args) && typeof args[0] === 'string') {
			var address = args[0];
			if (validationUtils.isValidAddress(address))
				Wallet.readTransactionHistory({address: address}, function (result) {
					cb(null, result);
				});
			else
				cb("invalid address");
		}
		else {
			var opts = {wallet: wallet_id};
			if (args.unit && validationUtils.isValidBase64(args.unit, constants.HASH_LENGTH))
				opts.unit = args.unit;
			if (args.since_mci && validationUtils.isNonnegativeInteger(args.since_mci))
				opts.since_mci = args.since_mci;
			else
				opts.limit = 200;
			if (args.asset) {
				if (!validationUtils.isValidBase64(args.asset, constants.HASH_LENGTH))
					return cb("bad asset: " + args.asset);
				opts.asset = args.asset;
			}
			Wallet.readTransactionHistory(opts, function (result) {
				console.log('listtransactions ' + JSON.stringify(args) + ' took ' + (Date.now() - start_time) + 'ms');
				cb(null, result);
			});
		}

	});

	/**
	 * Send funds to address.
	 * If address is invalid, then returns "invalid address".
	 * @param {String} address
	 * @param {Integer} amount
	 * @return {String} status
	 */
	server.expose('sendtoaddress', function (args, opt, cb) {
		console.log('sendtoaddress ' + JSON.stringify(args));
		let start_time = Date.now();
		var amount = args[1];
		var toAddress = args[0];
		var asset = args[2];
		if (asset && !validationUtils.isValidBase64(asset, constants.HASH_LENGTH))
			return cb("bad asset: " + asset);
		if (amount && toAddress) {
			if (validationUtils.isValidAddress(toAddress))
				headlessWallet.issueChangeAddressAndSendPayment(asset, amount, toAddress, null, function (err, unit) {
					console.log('sendtoaddress ' + JSON.stringify(args) + ' took ' + (Date.now() - start_time) + 'ms, unit=' + unit + ', err=' + err);
					cb(err, err ? undefined : unit);
				});
			else
				cb("invalid address");
		}
		else
			cb("wrong parameters");
	});

	/**
	 *  Returns all the address of headless
	 *  @return [{"address": ""}]
	 */
	server.expose('getaddresses', function (args, opt, cb) {
		console.log('getaddresses ' + JSON.stringify(args));
		var adds = [];
		db.query("SELECT address FROM my_addresses", function (rows) {
			if (rows.length === 0)
				throw Error("no wallets");
			for (var i in rows) {
				var property = rows[i];
				adds.push(property);
				console.log("Witness SingleAddress --------------> " + JSON.stringify(property) + "\n");
			}
			cb(null, adds);
		});
	});

	/**
	 *  创建资产
	 *  Returns asset info
	 *  @param [address,{}]
	 *  @return {}
	 */
	server.expose('createAsset', function (args, opt, cb) {
		var composer = require('byteballcore/composer.js');
		var network = require('byteballcore/network.js');
		var callbacks = composer.getSavingCallbacks({
			ifNotEnoughFunds: onError,
			ifError: onError,
			ifOk: function (objJoint) {
				network.broadcastJoint(objJoint);
				cb(null, objJoint);
			}
		});
		var asset = args[0];
		var address;
		if (args[1]) {
			address = args[1];
			composer.composeAssetDefinitionJoint(address, asset, headlessWallet.signer, callbacks);
		} else {
			getdefaultaddress(function (add) {
				address = add;
				composer.composeAssetDefinitionJoint(address, asset, headlessWallet.signer, callbacks);
			});
		}
	});

	server.expose('createDivisibleAssetPayment', function (args, opt, cb) {
		var network = require('byteballcore/network.js');
		var divisibleAsset = require('byteballcore/divisible_asset.js');
		var walletGeneral = require('byteballcore/wallet_general.js');

		divisibleAsset.composeAndSaveDivisibleAssetPaymentJoint({
			asset: args[0],
			paying_addresses: [args[1]],
			fee_paying_addresses: [args[1]],
			change_address: args[1],
			to_address: args[2],
			amount: args[3],
			signer: headlessWallet.signer,
			callbacks: {
				ifError: onError,
				ifNotEnoughFunds: onError,
				ifOk: function (objJoint, arrChains) {
					network.broadcastJoint(objJoint);
					cb(null, objJoint);
					if (arrChains) { // if the asset is private
						// send directly to the receiver
						network.sendPrivatePayment('wss://bsure.vip/bb', arrChains);

						// or send to the receiver's device address through the receiver's hub
						//walletGeneral.sendPrivatePayments("0F7Z7DDVBDPTYJOY7S4P24CW6K23F6B7S", arrChains);
					}
				}
			}
		});
	});

	server.expose('createIndivisibleAssetPayment', function (args, opt, cb) {
		var network = require('byteballcore/network.js');
		var indivisibleAsset = require('byteballcore/indivisible_asset.js');
		var walletGeneral = require('byteballcore/wallet_general.js');

		indivisibleAsset.composeAndSaveIndivisibleAssetPaymentJoint({
			asset: args[0],
			paying_addresses: [args[1]],
			fee_paying_addresses: [args[1]],
			change_address: args[1],
			to_address: args[2],
			amount: args[3],
			tolerance_plus: 0,
			tolerance_minus: 0,
			signer: headlessWallet.signer,
			callbacks: {
				ifError: onError,
				ifNotEnoughFunds: onError,
				ifOk: function(objJoint, arrRecipientChains, arrCosignerChains){
					network.broadcastJoint(objJoint);
					cb(null, objJoint);
					if (arrRecipientChains){ // if the asset is private
						// send directly to the receiver
						network.sendPrivatePayment('wss://example.org/bb', arrRecipientChains);

						// or send to the receiver's device address through the receiver's hub
						// walletGeneral.sendPrivatePayments("0DTZZY6J27KSEVEXL4BIGTZXAELJ47OYW", arrRecipientChains);
					}
				}
			}
		});
	});
	server.expose('createdata', function (args, opt, cb) {
		var composer = require('byteballcore/composer.js');
		var network = require('byteballcore/network.js');
		var callbacks = composer.getSavingCallbacks({
			ifNotEnoughFunds: onError,
			ifError: onError,
			ifOk: function (objJoint) {
				network.broadcastJoint(objJoint);
				cb(null, objJoint);
			}
		});
		composer.composeDataJoint(args[1], args[0], headlessWallet.signer, callbacks);
	});


	/**
	 * 获取资产元数据，传入asset单元unit数组
	 */
	server.expose('getAssetMetadata', function (args, opt, cb) {
		Wallet.readAssetMetadata(args, function (asset) {
			cb(null, asset);
		})
	});


	headlessWallet.readSingleWallet(function (_wallet_id) {
		wallet_id = _wallet_id;
		// listen creates an HTTP server on localhost only
		var httpServer = server.listen(conf.rpcPort, conf.rpcInterface);
		httpServer.timeout = 900 * 1000;
	});
}

function onError(err) {
	throw Error(err);
}

function getdefaultaddress(callback) {
	db.query("SELECT address FROM my_addresses", function (rows) {
		if (rows.length === 0)
			throw Error("no wallets");
		var address = rows[0].address;
		console.log("Witness SingleAddress --------------> " + JSON.stringify(address) + "\n");
		callback(address);
	});
}

eventBus.on('headless_wallet_ready', initRPC);
