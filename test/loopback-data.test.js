// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
var should = require('./init.js');

var loopbackData = require('../');

describe('loopback-datasource-juggler', function() {
  it('should expose version', function() {
    loopbackData.version.should.equal(require('../package.json').version);
  });
});
