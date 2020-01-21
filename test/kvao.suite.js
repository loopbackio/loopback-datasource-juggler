// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const debug = require('debug')('test');
const extend = require('util')._extend;
const fs = require('fs');
const path = require('path');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  connectorCapabilities = extend({
    // Even when the backend supports millisecond precision,
    // it's better to use intervals at least 10ms long in the tests
    ttlPrecision: 10,
  }, connectorCapabilities);

  describe('KeyValue API', function loadAllTestFiles() {
    const testRoot = path.resolve(__dirname, 'kvao');
    let testFiles = fs.readdirSync(testRoot);
    testFiles = testFiles.filter(function(it) {
      return !!require.extensions[path.extname(it).toLowerCase()] &&
        /\.suite\.[^.]+$/.test(it);
    });

    for (const ix in testFiles) {
      const name = testFiles[ix];
      const fullPath = path.resolve(testRoot, name);
      debug('Loading test suite %s (%s)', name, fullPath);
      require(fullPath)(dataSourceFactory, connectorCapabilities);
    }
  });
};
