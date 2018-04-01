"use strict";
const db = require('byteballcore/db.js');
const async = require('async');
const headlessWallet = require('../headless-byteball');
const eventBus = require('byteballcore/event_bus.js');
const constants = require('byteballcore/constants.js');
var myWitnesses = require('byteballcore/my_witnesses.js');

var arrobj = [
  {
        "address": "VZTB3A7GXXLETF7TOJ4NOSGVDL2U5JG3",
        "wallet": "3B2AnPGJu581q8tT/PVjagv3ujPa1u+WExbflgWqSsw=",
        "is_change": 0,
        "address_index": 0,
        "definition": "[\"sig\",{\"pubkey\":\"A2GGcDT5Oj+h8v1EOIrF3advSe+3O3aqlTnyay8vC0MX\"}]",
        "creation_date": "2017-10-25 02:37:31"
  },{
        "address": "FS6UYR55WTEMD4SE3UA3N6YM2KW7WVBZ",
        "wallet": "jNHVjQtE6gJd7HqnCHsHORUmsYTiOVnf9E3sRQn87Do=",
        "is_change": 0,
        "address_index": 0,
        "definition": "[\"sig\",{\"pubkey\":\"A2hfcM9hUUIU/VXbVPD35PQvJUnAVWfNKkVmCLaZsrUu\"}]",
        "creation_date": "2017-10-25 02:40:14"
  },{
        "address": "JNWLJX4NLOWNIAJYWEB5MFCR4MEP3ECQ",
        "wallet": "vmR8/05FVNSWdyWfzqHr920549BKdZuRZVP63BD0Z3E=",
        "is_change": 0,
        "address_index": 0,
        "definition": "[\"sig\",{\"pubkey\":\"A4WQqA5MFfvtoue/Q0bnyI9YHDmn2eHimmX3jAEbfjj4\"}]",
        "creation_date": "2017-10-25 02:40:36"
  }

];


async.eachSeries(arrobj, function(defobj, cb){
  db.query(
    "INSERT INTO my_addresses (address, wallet, is_change, address_index, definition, creation_date) VALUES(?,?,0,0,?,?)",
    [defobj.address, defobj.wallet, defobj.definition, defobj.creation_date]
    , function(){
      cb();
    });

});



db.query("SELECT * FROM my_addresses", function(rows){

       console.log("\n\n Show my_address Definition: \n");
      for (var i = 0; i < rows.length; i++) {
        console.log(JSON.stringify(rows[i], null,2));
      }
      process.exit(0);
  });
