// This test written in mocha+should.js
var should = require('./init.js');

var db, Model;

describe('datatypes', function () {

  // Used to emulate a custom id type
  function DummyType(value) {
    if (!(this instanceof DummyType) &&
      ( typeof value === 'string' || typeof value === 'object')) {

      return new DummyType(value);
    }

    if (typeof value === 'string') {
      this.value = value;
      return;
    } else if (typeof value === 'object') {
      this.value = value.value;
      return;
    }

    return value;
  };

  before(function (done) {
    db = getSchema();
    Model = db.define('Model', {
      str: String,
      date: Date,
      num: Number,
      bool: Boolean,
      dummy: DummyType,
      list: {type: []},
    });
    db.automigrate(function () {
      Model.destroyAll(done);
    });
  });

  it('should keep types when get read data from db', function (done) {
    var d = new Date, id;

    Model.create({
      str: 'hello', date: d, num: '3', bool: 1, list: ['test']
    }, function (err, m) {
      should.not.exist(err);
      should.exist(m && m.id);
      m.str.should.be.a('string');
      m.num.should.be.a('number');
      m.bool.should.be.a('boolean');
      id = m.id;
      testFind(testAll);
    });

    function testFind(next) {
      debugger;
      Model.findById(id, function (err, m) {
        should.not.exist(err);
        should.exist(m);
        m.str.should.be.a('string');
        m.num.should.be.a('number');
        m.bool.should.be.a('boolean');
        m.date.should.be.an.instanceOf(Date);
        m.date.toString().should.equal(d.toString(), 'Time must match');
        next();
      });
    }

    function testAll() {
      Model.findOne(function (err, m) {
        should.not.exist(err);
        should.exist(m);
        m.str.should.be.a('string');
        m.num.should.be.a('number');
        m.bool.should.be.a('boolean');
        m.date.should.be.an.instanceOf(Date);
        m.date.toString().should.equal(d.toString(), 'Time must match');
        done();
      });
    }

  });

  it('should respect data types when updating attributes', function (done) {
    var d = new Date, id;

    Model.create({
      str: 'hello', date: d, num: '3', bool: 1, dummy: new DummyType('dummy')
    }, function(err, m) {
      should.not.exist(err);
      should.exist(m && m.id);

      // sanity check initial types
      m.str.should.be.a('string');
      m.num.should.be.a('number');
      m.bool.should.be.a('boolean');
      m.dummy.should.be.an.instanceOf(DummyType);
      id = m.id;
      testDataInDB(function () {
        testUpdate(function() {
          testDataInDB(done);
        });
      });
    });

    function testUpdate(done) {
      Model.findById(id, function(err, m) {
        should.not.exist(err);

        // update using updateAttributes
        m.updateAttributes({
          id: id, dummy: 'NotADummy'
        }, function (err, m) {
          should.not.exist(err);
          m.dummy.should.be.an.instanceOf(DummyType);
          done();
        });
      });
    }

    function testDataInDB(done) {

      // verify that the value stored in the db is still an object
      db.connector.find(Model.modelName, id, function (err, data) {
        should.exist(data);
        data.dummy.should.be.a('object');
        done();
      });
    }
  });
});
