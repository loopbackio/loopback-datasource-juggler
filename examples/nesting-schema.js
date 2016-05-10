// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var ModelBuilder = require('../../loopback-datasource-juggler').ModelBuilder;
var modelBuilder = new ModelBuilder();

// simplier way to describe model
var User = modelBuilder.define('User', {
  name: String,
  bio: ModelBuilder.Text,
  approved: Boolean,
  joinedAt: Date,
  age: Number,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  emails: [
    {
      label: String,
      email: String,
    },
  ],
  friends: [String],
});

var user = new User({
  name: 'Joe',
  age: 20,
  address: {
    street: '123 Main St',
    city: 'San Jose',
    state: 'CA',
  },
  emails: [
    { label: 'work', email: 'xyz@sample.com' },
  ],
  friends: ['John', 'Mary'] });
console.log(user);
console.log(user.toObject());
