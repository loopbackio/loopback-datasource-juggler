// This test written in mocha+should.js
var should = require('./init.js');

var db = getSchema(), slave = getSchema(), Model, SlaveModel;

describe('dataSource', function () {

  it('should define Model', function () {
    Model = db.define('Model');
    Model.dataSource.should.eql(db);
    var m = new Model;
    m.getDataSource().should.eql(db);
  });

  it('should clone existing model', function () {
    SlaveModel = slave.copyModel(Model);
    SlaveModel.dataSource.should.equal(slave);
    // Workaround for an performance issue in `should` by customizing the msg
    // where it takes ages to evaluate `should.not.equal` for complex objects
    // https://github.com/shouldjs/should.js/blob/master/lib/assertion.js#L159-L162
    slave.should.not.equal(db, 'The two data sources should be different');
    var sm = new SlaveModel;
    sm.should.be.instanceOf(Model);
    sm.getDataSource().should.not.equal(db, 'The data source of an instance ' +
      'of the slave model should be different from the original one');
    sm.getDataSource().should.equal(slave);
  });

  it('should automigrate', function (done) {
    db.automigrate(done);
  });

  it('should create transaction', function (done) {
    var tr = db.transaction();
    tr.connected.should.be.false;
    tr.connecting.should.be.false;
    var called = false;
    tr.models.Model.create(Array(3), function () {
      called = true;
    });
    tr.connected.should.be.false;
    tr.connecting.should.be.true;

    db.models.Model.count(function (err, c) {
      should.not.exist(err);
      should.exist(c);
      c.should.equal(0);
      called.should.be.false;
      tr.exec(function () {
        setTimeout(function () {
          called.should.be.true;
          db.models.Model.count(function (err, c) {
            c.should.equal(3);
            done();
          });
        }, 100);
      });
    });
  });

});
