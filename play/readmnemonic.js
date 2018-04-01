/*jslint node: true */
"use strict";
var fs = require('fs');
var util = require('util');
var conf = require('byteballcore/conf.js');
var desktopApp = require('byteballcore/desktop_app.js');
var readline = require('readline');

var appDataDir = desktopApp.getAppDataDir();
var KEYS_FILENAME = appDataDir + '/' + (conf.KEYS_FILENAME || 'keys.json');

var readmem = function readKeys(){

  console.log("\n Read mnemonic...........\n");

	fs.readFile(KEYS_FILENAME, 'utf8', function(err, data){
		var rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			//terminal: true
		});
		if (err){ // first start
			console.log('failed to read keys.conf, you should generate a headless-wallet first!');
			throw Error('failed to read key.conf: '+err);
		}
		else{ // 2nd or later start
			rl.question("Passphrase: ", function(passphrase){
				rl.close();
				if (process.stdout.moveCursor) process.stdout.moveCursor(0, -1);
				if (process.stdout.clearLine)  process.stdout.clearLine();
				var keys = JSON.parse(data);
        keys.passphrase = passphrase; // add passphrase attrbuite
				console.log("\n Show Local wallet info ...........>>\n"
				+ JSON.stringify(keys, null, 2));
			});
		}
	});
};

readmem();
