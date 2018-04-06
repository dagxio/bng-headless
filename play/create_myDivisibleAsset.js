"use strict";
const headlessWallet = require('../headless');
const eventBus = require('byteballcore/event_bus.js');

function onError(err){
    throw Error(err);
}

function createMyAsset(address, onDone){
    var composer = require('byteballcore/composer.js');
    var network = require('byteballcore/network.js');

    var callbacks = composer.getSavingCallbacks({
        ifNotEnoughFunds: onError,
        ifError: onError,
        ifOk: function(objJoint){
            network.broadcastJoint(objJoint);
            onDone(objJoint.unit.unit);
        }
    });
    var asset = {
    //    cap: (1+2*2+5+10+20*2+50+100+200*2+500+1000+2000*2+5000+10000+20000*2+50000+100000)*1e10,
        cap: 1e8,
        is_private: false,
        is_transferrable: true,
        auto_destroy: false,
        fixed_denominations: false,
        issued_by_definer_only: true,
        cosigned_by_definer: false,
        spender_attested: false
    };
    composer.composeAssetDefinitionJoint(address, asset, headlessWallet.signer, callbacks);
}



eventBus.once('headless_wallet_ready', function() {
    headlessWallet.readSingleAddress(function(address) {
       createMyAsset(address, function(assetHash) {
            console.log("Somebytes asset created: " + assetHash);
            process.exit(0);
        });

    });
});
