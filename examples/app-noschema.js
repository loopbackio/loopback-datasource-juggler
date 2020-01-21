// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const DataSource = require('../../loopback-datasource-juggler').DataSource;
const ModelBuilder = require('../../loopback-datasource-juggler').ModelBuilder;
const introspectType = require('../lib/introspection')(ModelBuilder);

const ds = new DataSource('memory');

// Create a open model that doesn't require a schema
const Application = ds.createModel('Schemaless', {}, {strict: false});

const application = {
  owner: 'rfeng',
  name: 'MyApp1',
  description: 'My first app',
  pushSettings: [
    {'platform': 'apns',
      'apns': {
        'pushOptions': {
          'gateway': 'gateway.sandbox.push.apple.com',
          'cert': 'credentials/apns_cert_dev.pem',
          'key': 'credentials/apns_key_dev.pem',
        },

        'feedbackOptions': {
          'gateway': 'feedback.sandbox.push.apple.com',
          'cert': 'credentials/apns_cert_dev.pem',
          'key': 'credentials/apns_key_dev.pem',
          'batchFeedback': true,
          'interval': 300,
        },
      }},
  ]};

console.log(new Application(application).toObject());

Application.create(application, function(err, app1) {
  console.log('Created: ', app1.toObject());
  Application.findById(app1.id, function(err, app2) {
    console.log('Found: ', app2.toObject());
  });
});

// Instance JSON document
const user = {
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
    {label: 'work', id: 'x@sample.com'},
    {label: 'home', id: 'x@home.com'},
  ],
  tags: [],
};

// Introspect the JSON document to generate a schema
const schema = introspectType(user);

// Create a model for the generated schema
const User = ds.createModel('User', schema, {idInjection: true});

// Use the model for CRUD
const obj = new User(user);

console.log(obj.toObject());

User.create(user, function(err, u1) {
  console.log('Created: ', u1.toObject());
  User.findById(u1.id, function(err, u2) {
    console.log('Found: ', u2.toObject());
  });
});
