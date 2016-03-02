var should = require('./init.js');
var DataSource = require('../lib/datasource.js').DataSource;

describe('DataSource', function() {
  it('reports helpful error when connector init throws', function() {
    var throwingConnector = {
      name: 'loopback-connector-throwing',
      initialize: function(ds, cb) {
        throw new Error('expected test error');
      },
    };

    (function() {
      // this is what LoopBack does
      return new DataSource({
        name: 'dsname',
        connector: throwingConnector
      });
    }).should.throw(/loopback-connector-throwing/);
  });
});
