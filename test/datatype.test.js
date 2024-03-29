// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
const should = require('./init.js');

let db, Model, modelWithDecimalArray, dateArrayModel, numArrayModel;

class NestedClass {
  constructor(roleName) {
    this.roleName = roleName;
  }
}

describe('datatypes', function() {
  before(function(done) {
    db = getSchema();
    const Nested = db.define('Nested', {});
    const modelTableSchema = {
      str: String,
      date: Date,
      num: Number,
      bool: Boolean,
      list: {type: [String]},
      arr: Array,
      nested: Nested,
      nestedClass: NestedClass,
    };
    Model = db.define('Model', modelTableSchema);
    // 'modelWithDecimalArray' is too long an identifier name for Oracle DB
    modelWithDecimalArray = db.define('modelWithDecArr', {
      randomReview: {
        type: [String],
        mongodb: {
          dataType: 'Decimal128',
        },
      },
    });
    dateArrayModel = db.define('dateArrayModel', {
      bunchOfDates: [Date],
      bunchOfOtherDates: {
        type: [Date],
      },
    });
    numArrayModel = db.define('numArrayModel', {
      bunchOfNums: [Number],
    });
    db.automigrate(['Model', 'modelWithDecArr', 'dateArrayModel', 'numArrayModel'], done);
  });

  it('should resolve top-level "type" property correctly', function() {
    const Account = db.define('Account', {
      type: String,
      id: String,
    });
    Account.definition.properties.type.type.should.equal(String);
  });

  it('should resolve "type" sub-property correctly', function() {
    const Account = db.define('Account', {
      item: {type: {
        itemname: {type: String},
        type: {type: String},
      }},
    });
    Account.definition.properties.item.type.should.not.equal(String);
  });
  it('should resolve array prop with connector specific metadata', function() {
    const props = modelWithDecimalArray.definition.properties;
    props.randomReview.type.should.deepEqual(Array(String));
    props.randomReview.mongodb.should.deepEqual({dataType: 'Decimal128'});
  });

  it('should coerce array of dates from string', async () => {
    const dateVal = new Date('2019-02-21T12:00:00').toISOString();
    const created = await dateArrayModel.create({
      bunchOfDates: [dateVal,
        dateVal,
        dateVal],
      bunchOfOtherDates: [dateVal,
        dateVal,
        dateVal],
    });
    created.bunchOfDates[0].should.be.an.instanceOf(Date);
    created.bunchOfDates[0].should.deepEqual(new Date(dateVal));
    created.bunchOfOtherDates[0].should.be.an.instanceOf(Date);
    created.bunchOfOtherDates[0].should.deepEqual(new Date(dateVal));
  });

  it('should coerce array of numbers from string', async () => {
    const dateVal = new Date('2019-02-21T12:00:00').toISOString();
    const created = await numArrayModel.create({
      bunchOfNums: ['1',
        '2',
        '3'],
    });
    created.bunchOfNums[0].should.be.an.instanceOf(Number);
    created.bunchOfNums[0].should.equal(1);
  });

  it('should return 400 when property of type array is set to string value',
    function(done) {
      const myModel = db.define('myModel', {
        list: {type: ['object']},
      });

      myModel.create({list: 'This string will crash the server'}, function(err) {
        (err.statusCode).should.equal(400);
        done();
      });
    });

  it('should return 400 when property of type array is set to object value',
    function(done) {
      const myModel = db.define('myModel', {
        list: {type: ['object']},
      });

      myModel.create({list: {key: 'This string will crash the server'}}, function(err) {
        (err.statusCode).should.equal(400);
        done();
      });
    });

  it('should keep types when get read data from db', function(done) {
    const d = new Date('2015-01-01T12:00:00');
    let id;

    Model.create({
      str: 'hello', date: d, num: '3', bool: 1, list: ['test'], arr: [1, 'str'],
    }, function(err, m) {
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
      Model.findById(id, function(err, m) {
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
      Model.findOne(function(err, m) {
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

  it('should create nested object defined by a class when reading data from db', async () => {
    const d = new Date('2015-01-01T12:00:00');
    let id;
    const created = await Model.create({
      date: d,
      list: ['test'],
      arr: [1, 'str'],
      nestedClass: new NestedClass('admin'),
    });
    created.list.toJSON().should.deepEqual(['test']);
    created.arr.toJSON().should.deepEqual([1, 'str']);
    created.date.should.be.an.instanceOf(Date);
    created.date.toString().should.equal(d.toString(), 'Time must match');
    created.nestedClass.should.have.property('roleName', 'admin');

    const found = await Model.findById(created.id);
    should.exist(found);
    found.list.toJSON().should.deepEqual(['test']);
    found.arr.toJSON().should.deepEqual([1, 'str']);
    found.date.should.be.an.instanceOf(Date);
    found.date.toString().should.equal(d.toString(), 'Time must match');
    found.nestedClass.should.have.property('roleName', 'admin');
  });

  it('should create nested object defined by a class using createAll', async () => {
    const d = new Date('2015-01-01T12:00:00');
    let id;
    const [created] = await Model.createAll([
      {
        date: d,
        list: ['test'],
        arr: [1, 'str'],
        nestedClass: new NestedClass('admin'),
      },
    ]);
    created.list.toJSON().should.deepEqual(['test']);
    created.arr.toJSON().should.deepEqual([1, 'str']);
    created.date.should.be.an.instanceOf(Date);
    created.date.toString().should.equal(d.toString(), 'Time must match');
    created.nestedClass.should.have.property('roleName', 'admin');

    const found = await Model.findById(created.id);
    should.exist(found);
    found.list.toJSON().should.deepEqual(['test']);
    found.arr.toJSON().should.deepEqual([1, 'str']);
    found.date.should.be.an.instanceOf(Date);
    found.date.toString().should.equal(d.toString(), 'Time must match');
    found.nestedClass.should.have.property('roleName', 'admin');
  });

  it('should create nested objects defined by a class using multiple createAll calls', async () => {
    const d = new Date('2015-01-01T12:00:00');
    const result = await Promise.all([
      Model.createAll([
        {
          date: d,
          list: ['test 1'],
          arr: [1, 'str 1'],
          nestedClass: new NestedClass('admin 1'),
        },
      ]),
      Model.createAll([
        {
          date: d,
          list: ['test 2'],
          arr: [2, 'str 2'],
          nestedClass: new NestedClass('admin 2'),
        },
        {
          date: d,
          list: ['test 3'],
          arr: [3, 'str 3'],
          nestedClass: new NestedClass('admin 3'),
        },
      ]),
      Model.createAll([
        {
          date: d,
          list: ['test 4'],
          arr: [4, 'str 4'],
          nestedClass: new NestedClass('admin 4'),
        },
      ]),
      Model.createAll([
        {
          date: d,
          list: ['test 6'],
          arr: [6, 'str 6'],
          nestedClass: new NestedClass('admin 6'),
        },
      ]),
      Model.createAll([
        {
          date: d,
          list: ['test 5'],
          arr: [5, 'str 5'],
          nestedClass: new NestedClass('admin 5'),
        },
      ]),
    ]);
    const [created1] = result[0];
    const [created2, created3] = result[1];
    const [created4] = result[2];
    const [created6] = result[3];
    const [created5] = result[4];
    await created1.list.toJSON().should.deepEqual(['test 1']);
    created1.arr.toJSON().should.deepEqual([1, 'str 1']);
    created1.date.should.be.an.instanceOf(Date);
    created1.date.toString().should.equal(d.toString(), 'Time must match');
    created1.nestedClass.should.have.property('roleName', 'admin 1');
    await created2.list.toJSON().should.deepEqual(['test 2']);
    created2.arr.toJSON().should.deepEqual([2, 'str 2']);
    created2.date.should.be.an.instanceOf(Date);
    created2.date.toString().should.equal(d.toString(), 'Time must match');
    created2.nestedClass.should.have.property('roleName', 'admin 2');
    await created3.list.toJSON().should.deepEqual(['test 3']);
    created3.arr.toJSON().should.deepEqual([3, 'str 3']);
    created3.date.should.be.an.instanceOf(Date);
    created3.date.toString().should.equal(d.toString(), 'Time must match');
    created3.nestedClass.should.have.property('roleName', 'admin 3');
    await created4.list.toJSON().should.deepEqual(['test 4']);
    created4.arr.toJSON().should.deepEqual([4, 'str 4']);
    created4.date.should.be.an.instanceOf(Date);
    created4.date.toString().should.equal(d.toString(), 'Time must match');
    created4.nestedClass.should.have.property('roleName', 'admin 4');
    await created5.list.toJSON().should.deepEqual(['test 5']);
    created5.arr.toJSON().should.deepEqual([5, 'str 5']);
    created5.date.should.be.an.instanceOf(Date);
    created5.date.toString().should.equal(d.toString(), 'Time must match');
    created5.nestedClass.should.have.property('roleName', 'admin 5');
    await created6.list.toJSON().should.deepEqual(['test 6']);
    created6.arr.toJSON().should.deepEqual([6, 'str 6']);
    created6.date.should.be.an.instanceOf(Date);
    created6.date.toString().should.equal(d.toString(), 'Time must match');
    created6.nestedClass.should.have.property('roleName', 'admin 6');

    const found1 = await Model.findById(created1.id);
    should.exist(found1);
    found1.list.toJSON().should.deepEqual(['test 1']);
    found1.arr.toJSON().should.deepEqual([1, 'str 1']);
    found1.date.should.be.an.instanceOf(Date);
    found1.date.toString().should.equal(d.toString(), 'Time must match');
    found1.nestedClass.should.have.property('roleName', 'admin 1');

    const found2 = await Model.findById(created2.id);
    should.exist(found2);
    found2.list.toJSON().should.deepEqual(['test 2']);
    found2.arr.toJSON().should.deepEqual([2, 'str 2']);
    found2.date.should.be.an.instanceOf(Date);
    found2.date.toString().should.equal(d.toString(), 'Time must match');
    found2.nestedClass.should.have.property('roleName', 'admin 2');

    const found3 = await Model.findById(created3.id);
    should.exist(found3);
    found3.list.toJSON().should.deepEqual(['test 3']);
    found3.arr.toJSON().should.deepEqual([3, 'str 3']);
    found3.date.should.be.an.instanceOf(Date);
    found3.date.toString().should.equal(d.toString(), 'Time must match');
    found3.nestedClass.should.have.property('roleName', 'admin 3');

    const found4 = await Model.findById(created4.id);
    should.exist(found4);
    found4.list.toJSON().should.deepEqual(['test 4']);
    found4.arr.toJSON().should.deepEqual([4, 'str 4']);
    found4.date.should.be.an.instanceOf(Date);
    found4.date.toString().should.equal(d.toString(), 'Time must match');
    found4.nestedClass.should.have.property('roleName', 'admin 4');

    const found5 = await Model.findById(created5.id);
    should.exist(found5);
    found5.list.toJSON().should.deepEqual(['test 5']);
    found5.arr.toJSON().should.deepEqual([5, 'str 5']);
    found5.date.should.be.an.instanceOf(Date);
    found5.date.toString().should.equal(d.toString(), 'Time must match');
    found5.nestedClass.should.have.property('roleName', 'admin 5');

    const found6 = await Model.findById(created6.id);
    should.exist(found6);
    found6.list.toJSON().should.deepEqual(['test 6']);
    found6.arr.toJSON().should.deepEqual([6, 'str 6']);
    found6.date.should.be.an.instanceOf(Date);
    found6.date.toString().should.equal(d.toString(), 'Time must match');
    found6.nestedClass.should.have.property('roleName', 'admin 6');
  });

  it('should respect data types when updating attributes', function(done) {
    const d = new Date;
    let id;

    Model.create({
      str: 'hello', date: d, num: '3', bool: 1}, function(err, m) {
      should.not.exist(err);
      should.exist(m && m.id);

      // sanity check initial types
      m.str.should.be.type('string');
      m.num.should.be.type('number');
      m.bool.should.be.type('boolean');
      id = m.id;
      testDataInDB(function() {
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
          id: m.id, num: 10,
        }, function(err, m) {
          should.not.exist(err);
          m.num.should.be.type('number');
          done();
        });
      });
    }

    function testDataInDB(done) {
      // verify that the value stored in the db is still an object
      function cb(err, data) {
        should.exist(data);
        data.num.should.be.type('number');
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
    const coerced = Model._coerce({nested: {foo: 'bar'}});
    coerced.nested.constructor.name.should.equal('Object');
  });

  it('rejects array value converted to NaN for a required property',
    function(done) {
      db = getSchema();
      Model = db.define('RequiredNumber', {
        num: {type: Number, required: true},
      });
      db.automigrate(['Model'], function() {
        Model.create({num: [1, 2, 3]}, function(err, inst) {
          should.exist(err);
          err.should.have.property('name').equal('ValidationError');
          done();
        });
      });
    });

  it('handles null data', (done) => {
    db = getSchema();
    Model = db.define('HandleNullModel', {
      data: {type: 'string'},
    });
    db.automigrate(['HandleNullModel'], function() {
      const a = new Model(null);
      done();
    });
  });

  describe('model option persistUndefinedAsNull', function() {
    let TestModel, isStrict;
    before(function(done) {
      db = getSchema();
      TestModel = db.define(
        'TestModel',
        {
          name: {type: String, required: false},
          desc: {type: String, required: false},
          stars: {type: Number, required: false},
        },
        {
          persistUndefinedAsNull: true,
        },
      );

      isStrict = TestModel.definition.settings.strict;

      db.automigrate(['TestModel'], done);
    });

    it('should set missing optional properties to null', function(done) {
      const EXPECTED = {desc: null, stars: null};
      TestModel.create({name: 'a-test-name'}, function(err, created) {
        if (err) return done(err);
        created.should.have.properties(EXPECTED);

        TestModel.findById(created.id, function(err, found) {
          if (err) return done(err);
          found.should.have.properties(EXPECTED);
          done();
        });
      });
    });

    it('should convert property value undefined to null', function(done) {
      const EXPECTED = {desc: null, extra: null};
      const data = {desc: undefined, extra: undefined};
      if (isStrict) {
        // SQL-based connectors don't support dynamic properties
        delete EXPECTED.extra;
        delete data.extra;
      }
      TestModel.create(data, function(err, created) {
        if (err) return done(err);

        created.should.have.properties(EXPECTED);

        TestModel.findById(created.id, function(err, found) {
          if (err) return done(err);
          found.should.have.properties(EXPECTED);
          done();
        });
      });
    });

    it('should convert undefined to null in the setter', function() {
      const inst = new TestModel();
      inst.desc = undefined;
      inst.should.have.property('desc', null);
      inst.toObject().should.have.property('desc', null);
    });

    it('should use null in unsetAttribute()', function() {
      const inst = new TestModel();
      inst.unsetAttribute('stars');
      inst.should.have.property('stars', null);
      inst.toObject().should.have.property('stars', null);
    });

    it('should convert undefined to null on save', function(done) {
      const EXPECTED = {desc: null, stars: null, extra: null, dx: null};
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

          created.should.have.properties(EXPECTED);
          saved.should.have.properties(EXPECTED);

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
              cb,
            );
          } else {
            TestModel.dataSource.connector.all(
              TestModel.modelName,
              {where: {id: created.id}},
              cb,
            );
          }
        });
      });
    });

    it('should convert undefined to null in toObject()', function() {
      const inst = new TestModel();
      inst.desc = undefined; // Note: this may be a no-op
      inst.unsetAttribute('stars');
      inst.extra = undefined;
      inst.__data.dx = undefined;

      inst.toObject(false).should.have.properties({
        desc: null, stars: null, extra: null, dx: null,
      });
    });
  });
});
