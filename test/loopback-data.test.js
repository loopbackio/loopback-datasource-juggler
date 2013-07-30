// This test written in mocha+should.js
var should = require('./init.js');

var loopbackData = require('../');

describe('loopback-datasource-juggler', function() {
    it('should expose version', function () {
        loopbackData.version.should.equal(require('../package.json').version);
    });
});
