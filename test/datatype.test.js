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
    db.automigrate(['Model'], done);
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
    var d = new Date;
    var id;
    
    Model.create({
      str: 'hello', date: d, num: '3', bool: 1, list: ['test'], arr: [1, 'str']
    }, function (err, m) {
      should.not.exists(err);
      should.exist(m && m.id);
      should(m.str).be.type('string');
      should(m.num).be.type('number');
      should(m.bool).be.type('boolean');
      m.list[0].should.be.equal('test');
      m.arr[0].should.be.equal(1);
      m.arr[1].should.be.equal('str');
      m.date.should.be.an.instanceOf(Date);
      m.date.toString().should.equal(d.toString())
      id = m.id;
      testFind(testAll);
    });

    function testFind(next) {
      Model.findById(id, function (err, m) {
        should.not.exist(err);
        should.exist(m);
        should(m.str).be.type('string');
        should(m.num).be.type('number');
        should(m.bool).be.type('boolean');
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
        should(m.str).be.type('string');
        should(m.num).be.type('number');
        should(m.bool).be.type('boolean');
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
      should(m.str).be.type('string');
      should(m.num).be.type('number');
      should(m.bool).be.type('boolean');
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
          id: m.id, num: '10'
        }, function (err, m) {
          should.not.exist(err);
          done();
        });
      });
    }

    function testDataInDB(done) {

      // verify that the value stored in the db is still an object
      function cb(err, data) {
        should.exist(data);
        should(data.num).be.type('number');
        done();
      }

      if (db.connector.find.length === 4) {
        db.connector.find(Model.modelName, id, {}, cb);
      } else {
        db.connector.find(Model.modelName, id, cb);
      }
    }
  });

  it('should not coerce nested objects into ModelConstructor types', function() {
      var coerced = Model._coerce({ nested: { foo: 'bar' } });
      coerced.nested.constructor.name.should.equal('Object');
  });

  it('rejects array value converted to NaN for a required property',
  function(done) {
    db = getSchema();
    Model = db.define('RequiredNumber', {
      num: { type: Number, required: true }
    });
    db.automigrate(['Model'], function () {
      Model.create({ num: [1,2,3] }, function(err, inst) {
        should.exist(err);
        err.should.have.property('name').equal('ValidationError');
        done();
      });
    });
  });

  describe('model option persistUndefinedAsNull', function() {
    var TestModel, isStrict;
    before(function(done) {
      TestModel = db.define(
        'TestModel',
        {
          desc: { type: String, required: false },
          stars: { type: Number, required: false }
        },
        {
          persistUndefinedAsNull: true
        });

      isStrict = TestModel.definition.settings.strict;

      db.automigrate(['TestModel'], done);
    });

    it('should set missing optional properties to null', function(done) {
      TestModel.create({ name: 'a-test-name' }, function(err, created) {
        if (err) return done(err);
        created.should.have.property('desc', null);        
        created.should.have.property('stars', null);

        TestModel.findById(created.id, function(err, found) {
          if (err) return done(err);
          created.should.have.property('desc', null);        
          created.should.have.property('stars', null);
          done();
        });
      });
    });

    it('should convert property value undefined to null', function(done) {     
      if (isStrict) {
        // SQL-based connectors don't support dynamic properties
        delete EXPECTED.extra;
      }

      var data ={ desc: undefined, extra: undefined };
      TestModel.create(data, function(err, created) {
        if (err) return done(err);

        created.should.have.property('desc', null);        
        created.should.have.property('stars', null);

        TestModel.findById(created.id, function(err, found) {
          if (err) return done(err);
          
          created.should.have.property('desc', null);        
          created.should.have.property('stars', null);
          
          done();
        });
      });
    });

    it('should convert undefined to null in the setter', function() {
      var inst = new TestModel();
      inst.desc = undefined;
      inst.should.have.property('desc', null);
      inst.toObject().should.have.property('desc', null);
    });

    it('should use null in unsetAttribute()', function() {
      var inst = new TestModel();
      inst.unsetAttribute('stars');
      inst.should.have.property('stars', null);
      inst.toObject().should.have.property('stars', null);
    });

    // TODO: There is a bug for this; please refer to https://github.com/strongloop/loopback-connector-redis/issues/9
    it.skip('should convert undefined to null on save', function(done) {
      if (isStrict) {
        // SQL-based connectors don't support dynamic properties
        delete EXPECTED.extra;
        delete EXPECTED.dx;
      }

      TestModel.create({}, function(err, created) {
        if (err) return done(err);
        
        created.desc = undefined; // Note: this is may be a no-op
        created.unsetAttribute('stars');
        created.extra = undefined;
        created.__data.dx = undefined;

        created.save(function(err, saved) {
          if (err) return done(err);

          saved.should.have.property('extra', null);
          saved.should.have.property('dx', null);

          function cb(err, found) {
            if (err) return done(err);
            should.exist(found[0]);
            found[0].should.have.properties(EXPECTED);
            done();
          }

          if (TestModel.dataSource.connector.all.length === 4) {
            TestModel.dataSource.connector.all(
              TestModel.modelName,
              {where: {id: created.id}},
              {},
              cb
            );
          } else {
            TestModel.dataSource.connector.all(
              TestModel.modelName,
              {where: {id: created.id}},
              cb
            );
          }
        });
      });
    });

    it('should convert undefined to null in toObject()', function() {
      var inst = new TestModel();
      inst.desc = undefined; // Note: this may be a no-op
      inst.unsetAttribute('stars');
      inst.extra = undefined;
      inst.__data.dx = undefined;

      var result =  inst.toObject(false);
      result.should.have.property('desc', null);
      result.should.have.property('stars', null);
      result.should.have.property('extra', null);
      result.should.have.property('dx', null);
    });
  });
});
