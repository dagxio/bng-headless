/*jslint node: true */
"use strict";
var headlessWallet = require('../start.js');
var eventBus = require('bng-core/event_bus.js');

function onError(err){
	throw Error(err);
}

function createPayment(){
	var composer = require('bng-core/composer.js');
	var network = require('bng-core/network.js');
	var callbacks = composer.getSavingCallbacks({
		ifNotEnoughFunds: onError,
		ifError: onError,
		ifOk: function(objJoint){
			network.broadcastJoint(objJoint);
		}
	});
	
	var from_address = "ANXET2RR24FPAAAYQ5YOIWLMJWVBD2M7";
	var payee_address = "6PNP4GLXEWYCVCAGPHXVRXWFNO2XVPYM";
	var arrOutputs = [
		{address: from_address, amount: 0},      // the change
		{address: payee_address, amount: 8619}  // the receiver
	];
	composer.composePaymentJoint([from_address], arrOutputs, headlessWallet.signer, callbacks);
}

eventBus.on('headless_wallet_ready', createPayment);
