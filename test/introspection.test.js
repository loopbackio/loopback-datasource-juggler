// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var assert = require('assert');
var ModelBuilder = require('..').ModelBuilder;
var DataSource = require('../').DataSource;
var introspectType = require('../lib/introspection')(ModelBuilder);
var traverse = require('traverse');

var json = {
  name: 'Joe',
  age: 30,
  birthday: new Date(),
  vip: true,
  address: {
    street: '1 Main St',
    city: 'San Jose',
    state: 'CA',
    zipcode: '95131',
    country: 'US',
  },
  friends: ['John', 'Mary'],
  emails: [
    { label: 'work', id: 'x@sample.com' },
    { label: 'home', id: 'x@home.com' },
  ],
  tags: [],
};

describe('Introspection of model definitions from JSON', function() {
  it('should handle simple types', function() {
    assert.equal(introspectType('123'), 'string');
    assert.equal(introspectType(true), 'boolean');
    assert.equal(introspectType(false), 'boolean');
    assert.equal(introspectType(12), 'number');
    assert.equal(introspectType(new Date()), 'date');
  });

  it('should handle array types', function() {
    var type = introspectType(['123']);
    assert.deepEqual(type, ['string'], 'type should be ["string"]');
    type = introspectType([1]);
    assert.deepEqual(type, ['number'], 'type should be ["number"]');
    // Stop at first known type
    type = introspectType([1, '123']);
    assert.deepEqual(type, ['number'], 'type should be ["number"]');
    type = introspectType([null, '123']);
    assert.deepEqual(type, ['string'], 'type should be ["string"]');

    type = introspectType([]);
    assert.equal(type, 'array');
  });

  it('should return Any for null or undefined', function() {
    assert.equal(introspectType(null), ModelBuilder.Any);
    assert.equal(introspectType(undefined), ModelBuilder.Any);
  });

  it('should return a schema for object', function() {
    var json = { a: 'str', b: 0, c: true };
    var type = introspectType(json);
    assert.equal(type.a, 'string');
    assert.equal(type.b, 'number');
    assert.equal(type.c, 'boolean');
  });

  it('should handle nesting objects', function() {
    var json = { a: 'str', b: 0, c: true, d: { x: 10, y: 5 }};
    var type = introspectType(json);
    assert.equal(type.a, 'string');
    assert.equal(type.b, 'number');
    assert.equal(type.c, 'boolean');
    assert.equal(type.d.x, 'number');
    assert.equal(type.d.y, 'number');
  });

  it('should handle nesting arrays', function() {
    var json = { a: 'str', b: 0, c: true, d: [1, 2] };
    var type = introspectType(json);
    assert.equal(type.a, 'string');
    assert.equal(type.b, 'number');
    assert.equal(type.c, 'boolean');
    assert.deepEqual(type.d, ['number']);
  });

  it('should build a model from the introspected schema', function(done) {
    var copy = traverse(json).clone();

    var schema = introspectType(json);

    var builder = new ModelBuilder();
    var Model = builder.define('MyModel', schema, { idInjection: false });

    // FIXME: [rfeng] The constructor mutates the arguments
    var obj = new Model(json);

    obj = obj.toObject();

    assert.deepEqual(obj, copy);
    done();
  });

  it('should build a model using buildModelFromInstance', function(done) {
    var copy = traverse(json).clone();

    var builder = new ModelBuilder();
    var Model = builder.buildModelFromInstance('MyModel', copy, { idInjection: false });

    var obj = new Model(json);
    obj = obj.toObject();
    assert.deepEqual(obj, copy);
    done();
  });

  it('should build a model using DataSource.buildModelFromInstance', function(done) {
    var copy = traverse(json).clone();

    var builder = new DataSource('memory');
    var Model = builder.buildModelFromInstance('MyModel', copy,
      { idInjection: false });

    assert.equal(Model.dataSource, builder);

    var obj = new Model(json);
    obj = obj.toObject();
    assert.deepEqual(obj, copy);
    done();
  });
});

