// This test written in mocha+should.js
var should = require('./init.js');

var db, Model;

describe('datatypes', function () {

  before(function (done) {
    db = getSchema();
    Nested = db.define('Nested', {});

    Model = db.define('Model', {
      str: String,
      date: Date,
      num: Number,
      bool: Boolean,
      list: {type: [String]},
      arr: Array,
      nested: Nested
    });
    db.automigrate(function () {
      Model.destroyAll(done);
    });
  });

  it('should return 400 when property of type array is set to string value',
    function (done) {
      var myModel = db.define('myModel', {
        list: { type: ['object'] }
      });

      (function(){
        myModel.create({ list: 'This string will crash the server' });
      }).should.throw({ statusCode: 400 });

      done();
  });

  it('should return 400 when property of type array is set to object value',
    function (done) {
      var myModel = db.define('myModel', {
        list: { type: ['object'] }
      });

      (function(){
        myModel.create({ list: { key: 'This string will crash the server' } });
      }).should.throw({ statusCode: 400 });

      done();
  });

  it('should keep types when get read data from db', function (done) {
    var d = new Date, id;

    Model.create({
      str: 'hello', date: d, num: '3', bool: 1, list: ['test'], arr: [1, 'str']
    }, function (err, m) {
      should.not.exists(err);
      should.exist(m && m.id);
      m.str.should.be.type('string');
      m.num.should.be.type('number');
      m.bool.should.be.type('boolean');
      m.list[0].should.be.equal('test');
      m.arr[0].should.be.equal(1);
      m.arr[1].should.be.equal('str');
      id = m.id;
      testFind(testAll);
    });

    function testFind(next) {
      Model.findById(id, function (err, m) {
        should.not.exist(err);
        should.exist(m);
        m.str.should.be.type('string');
        m.num.should.be.type('number');
        m.bool.should.be.type('boolean');
        m.list[0].should.be.equal('test');
        m.arr[0].should.be.equal(1);
        m.arr[1].should.be.equal('str');
        m.date.should.be.an.instanceOf(Date);
        m.date.toString().should.equal(d.toString(), 'Time must match');
        next();
      });
    }

    function testAll() {
      Model.findOne(function (err, m) {
        should.not.exist(err);
        should.exist(m);
        m.str.should.be.type('string');
        m.num.should.be.type('number');
        m.bool.should.be.type('boolean');
        m.date.should.be.an.instanceOf(Date);
        m.date.toString().should.equal(d.toString(), 'Time must match');
        done();
      });
    }

  });

  it('should respect data types when updating attributes', function (done) {
    var d = new Date, id;

    Model.create({
      str: 'hello', date: d, num: '3', bool: 1}, function(err, m) {
      should.not.exist(err);
      should.exist(m && m.id);

      // sanity check initial types
      m.str.should.be.type('string');
      m.num.should.be.type('number');
      m.bool.should.be.type('boolean');
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
          id: id, num: '10'
        }, function (err, m) {
          should.not.exist(err);
          m.num.should.be.type('number');
          done();
        });
      });
    }

    function testDataInDB(done) {

      // verify that the value stored in the db is still an object
      db.connector.find(Model.modelName, id, function (err, data) {
        should.exist(data);
        data.num.should.be.type('number');
        done();
      });
    }
  });

  it('should not coerce nested objects into ModelConstructor types', function() {
      var coerced = Model._coerce({ nested: { foo: 'bar' } });
      coerced.nested.constructor.name.should.equal('Object');
  });

});
