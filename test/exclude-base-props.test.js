// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';
var should = require('./init.js');
var assert = require('assert');

var jdb = require('../');
var ModelBuilder = jdb.ModelBuilder;

describe('exclude properties ', function() {
  it('from base model', function(done) {
    var ds = new ModelBuilder();
    // this excludes id property from 'base: Model' We still need to pass in idInjection: false since User model tries to
    // add id again to the model.
    var User = ds.define('User', {name: String, password: String},
      {idInjection: false, excludeBaseProperties: ['id']});
    // User will have these properties: name, password
    var properties = User.definition.properties;

    var notFound = true;
    for (var p in properties) {
      if (p == 'id') {
        notFound = false; // id should not be found in the properties list
      }
    }
    assert.equal(notFound, true);

    // this excludes id property from the base model and and password property coming from base 'User' model since customer is
    // extended from User.
    var Customer = User.extend('Customer', {vip: {type: String}},
      {idInjection: false, excludeBaseProperties: ['password']});
    // Customer will have these properties: name, vip
    properties = Customer.definition.properties;
    notFound = true;
    for (p in properties) {
      if (p == 'id' || p == 'password') {
        notFound = false; // id and password properties should not be found in the properties list
      }
    }
    assert.equal(notFound, true);
    done();
  });
});
