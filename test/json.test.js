// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
var should = require('./init.js');

var Schema = require('../').Schema;
var ModelBuilder = require('../').ModelBuilder;

describe('JSON property', function() {
  var dataSource, Model;

  it('should be defined', function() {
    dataSource = getSchema();
    Model = dataSource.define('Model', {propertyName: ModelBuilder.JSON});
    var m = new Model;
    (new Boolean('propertyName' in m)).should.eql(true);
    should.not.exist(m.propertyName);
  });

  it('should accept JSON in constructor and return object', function() {
    var m = new Model({
      propertyName: '{"foo": "bar"}',
    });
    m.propertyName.should.be.an.Object;
    m.propertyName.foo.should.equal('bar');
  });

  it('should accept object in setter and return object', function() {
    var m = new Model;
    m.propertyName = {'foo': 'bar'};
    m.propertyName.should.be.an.Object;
    m.propertyName.foo.should.equal('bar');
  });

  it('should accept string in setter and return string', function() {
    var m = new Model;
    m.propertyName = '{"foo": "bar"}';
    m.propertyName.should.be.a.String;
    m.propertyName.should.equal('{"foo": "bar"}');
  });
});
