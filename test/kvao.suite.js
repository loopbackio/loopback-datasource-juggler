'use strict';

var debug = require('debug')('test');
var extend = require('util')._extend;
var fs = require('fs');
var path = require('path');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  connectorCapabilities = extend({
    // Even when the backend supports millisecond precision,
    // it's better to use intervals at least 10ms long in the tests
    ttlPrecision: 10,
  }, connectorCapabilities);

  describe('KeyValue API', function loadAllTestFiles() {
    var testRoot = path.resolve(__dirname, 'kvao');
    var testFiles = fs.readdirSync(testRoot);
    testFiles = testFiles.filter(function(it) {
      return !!require.extensions[path.extname(it).toLowerCase()] &&
        /\.suite\.[^.]+$/.test(it);
    });

    for (var ix in testFiles) {
      var name = testFiles[ix];
      var fullPath = path.resolve(testRoot, name);
      debug('Loading test suite %s (%s)', name, fullPath);
      require(fullPath)(dataSourceFactory, connectorCapabilities);
    }
  });
};
