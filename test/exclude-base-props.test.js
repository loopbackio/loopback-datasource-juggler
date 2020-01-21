// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';
const should = require('./init.js');
const assert = require('assert');

const jdb = require('../');
const ModelBuilder = jdb.ModelBuilder;

describe('exclude properties ', function() {
  it('from base model', function(done) {
    const ds = new ModelBuilder();
    // create a base model User which has name and password properties. id property gets
    // internally created for the User Model
    const User = ds.define('User', {name: String, password: String});
    let properties = User.definition.properties;
    // User should have id, name & password properties
    assert(('id' in properties) && ('password' in properties) && ('name' in properties),
      'User should have id, name & password properties');
    // Create sub model Customer with vip as property. id property gets automatically created here as well.
    // Customer will inherit name, password and id from base User model.
    // With excludeBaseProperties, 'password' and 'id' gets excluded from base User model
    // With idInjection: false - id property of sub Model Customer gets excluded. At the end
    // User will have these 2 properties: name (inherited from User model) and vip (from customer Model).
    const Customer = User.extend('Customer', {vip: {type: String}},
      {idInjection: false, excludeBaseProperties: ['password', 'id']});
    // Customer should have these properties: name(from UserModel) & vip
    properties = Customer.definition.properties;
    assert(('name' in properties) && ('vip' in properties),
      'Customer should have name and vip properties');
    // id or password properties should not be found in the properties list
    assert(!(('id' in properties) || ('password' in properties)),
      'Customer should not have id or password properties');
    done();
  });
});
