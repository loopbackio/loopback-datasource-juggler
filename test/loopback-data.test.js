// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';
const should = require('./init.js');

const loopbackData = require('../');

describe('loopback-datasource-juggler', function() {
  it('should expose version', function() {
    loopbackData.version.should.equal(require('../package.json').version);
  });
});
