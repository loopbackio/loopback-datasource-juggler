// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
const should = require('./init.js');

const Schema = require('../').Schema;
const ModelBuilder = require('../').ModelBuilder;

describe('JSON property', function() {
  let dataSource, Model;

  it('should be defined', function() {
    dataSource = getSchema();
    Model = dataSource.define('Model', {propertyName: ModelBuilder.JSON});
    const m = new Model;
    (new Boolean('propertyName' in m)).should.eql(true);
    should.not.exist(m.propertyName);
  });

  it('should accept JSON in constructor and return object', function() {
    const m = new Model({
      propertyName: '{"foo": "bar"}',
    });
    m.propertyName.should.be.an.Object;
    m.propertyName.foo.should.equal('bar');
  });

  it('should accept object in setter and return object', function() {
    const m = new Model;
    m.propertyName = {'foo': 'bar'};
    m.propertyName.should.be.an.Object;
    m.propertyName.foo.should.equal('bar');
  });

  it('should accept string in setter and return string', function() {
    const m = new Model;
    m.propertyName = '{"foo": "bar"}';
    m.propertyName.should.be.a.String;
    m.propertyName.should.equal('{"foo": "bar"}');
  });
});
