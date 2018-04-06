"use strict";
const headlessWallet = require('../headless');
const eventBus = require('byteballcore/event_bus.js');

function onError(err){
    throw Error(err);
}


function issueMyAsset(address, onDone){
    var composer = require('byteballcore/composer.js');
    var network = require('byteballcore/network.js');
    var objectHash =  require('byteballcore/object_hash.js');

    var callbacks = composer.getSavingCallbacks({
        ifNotEnoughFunds: onError,
        ifError: onError,
        ifOk: function(objJoint){
            network.broadcastJoint(objJoint);
            onDone(objJoint.unit.unit);
        }
    });

    var my_payload = {
        asset: "ijDEGiL6c9p6z4I8uDoEeHhqOTpU5h9krmuwtuuGZdI=",
        inputs: [
          {
            type: "issue",
            amount: 100000000,
            serial_number: 1
          }
        ],
        outputs: [
          {
            address: "FSASF3INY2HD74CLWDJYBN5L2XVTYIGK",
            amount: 50000000
          },
          {
            address: "MNTER5HW4VPFEKEEXKWIWSC344YFROSI",
            amount: 50000000
          }
        ]
      };

      function my_composeContentJoint(from_address, app, payload, signer, callbacks){
      	var objMessage = {
      		app: app,
      		payload_location: "inline",
      		payload_hash: objectHash.getBase64Hash(payload),
      		payload: payload
      	};
      	composer.composeJoint({
      		paying_addresses: [from_address],
      		outputs: [{address: from_address, amount: 0}],
      		messages: [objMessage],
      		signer: signer,
      		callbacks: callbacks
      	});
      }

    my_composeContentJoint(address, "payment", my_payload, headlessWallet.signer, callbacks)
}

eventBus.once('headless_wallet_ready', function() {
    headlessWallet.readSingleAddress(function(address) {

        issueMyAsset(address, function(assetHash) {
            console.log("Somebytes asset issued: " + assetHash);
            process.exit(0);
        });
    });
});
