#!/usr/bin/env node

if (process.env.npm_config_production) return;

var path = require('path');
var juggler = path.resolve(path.dirname(__filename), '..');
var cp = require('child_process');

console.log('Installing dev dependencies in', juggler);
process.chdir(juggler);

cp.exec('npm install', function(err, stdout, stderr) {
  if (err) throw err;
  if (stderr) console.log(stderr);
});
