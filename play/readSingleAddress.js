"use strict";
const db = require('byteballcore/db.js');
const headlessWallet = require('../headless-byteball');
const eventBus = require('byteballcore/event_bus.js');
const constants = require('byteballcore/constants.js');

function onError(err) {
    throw Error(err);
}


eventBus.once('headless_wallet_ready', function() {
    headlessWallet.readSingleAddress(function(address) {
            console.log(" \n\n Witness SingleAddress ------>>--------> " +  address + "\n");
              process.exit(0);
    });
});

