var async = require('async');
var should = require('./init.js');
var DataSource = require('../').DataSource;

describe('connectors', function() {
  var connectors = ['memory', 'transient'];

  it('should implement the `updateAll` function', function(done) {
    connectors.forEach(function(connector) {
      var ds = new DataSource({connector: connector});
      var Model = ds.define('Model');
      Model.updateAll.should.be.a.Function;
    });
    done();
  });

  it('should return the number of updated records', function(done) {
    async.forEach(connectors, function(connector, callback) {
      var ds = new DataSource({connector: connector});
      var User = ds.define('User');
      async.waterfall([
        function(cb) {
          User.create({id: 1, name: 'foo'}, cb);
        },
        function(model, cb) {
          User.update({name: 'baz'}, cb);
        },
        function(count, cb) {
          connector === 'transient' ?
            // The transient connector doesn't actually update any records
            count.should.be.a.Number.and.be.exactly(0) :
            count.should.be.a.Number.and.be.exactly(1);
          cb();
        }
      ], callback);
    }, function(err) {
      should.not.exist(err);
      done();
    });
  });
});
