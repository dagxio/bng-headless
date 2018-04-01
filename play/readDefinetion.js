/*jslint node: true */

/*
To be used by exchanges in order to move balance away from deposit addresses
*/

"use strict";
var headlessWallet = require('../headless-byteball');
var eventBus = require('byteballcore/event_bus.js');
var db = require('byteballcore/db.js');
var conf = require('byteballcore/conf.js');

var Objdef = {
	address : "",
	wallet  : "",
	is_change : 0,
	address_index: 0,
	definition: "",
	creation_date: ""
} ;



function onError(err){
	throw Error(err);
}


function getDefinition(){
	var composer = require('byteballcore/composer.js');
	var network = require('byteballcore/network.js');

	headlessWallet.readSingleAddress(function(address) {
		db.query(
			"SELECT definition FROM my_addresses WHERE address=? UNION SELECT definition FROM shared_addresses WHERE shared_address=?",
			[address, address],
			function(rows){

					if (rows.length !== 1)
						throw Error("definition not found");

					Objdef.definition = JSON.stringify(JSON.parse(rows[0].definition)) ;
					Objdef.address = address;
					console.log( "\n\n------------>>The Witness definition is : \n" + //JSON.stringify(JSON.parse(rows[0].definition), null, 2) );
					JSON.stringify(Objdef) );
					process.exit(0);
			}
		);
	});
}





eventBus.on('headless_wallet_ready', function(){
	headlessWallet.readSingleWallet(function(_wallet){
		Objdef.wallet = _wallet ;
		getDefinition();
	});
});
