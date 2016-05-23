// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
var should = require('./init.js');

var j = require('../'),
  Schema = j.Schema,
  AbstractClass = j.AbstractClass,
  Hookable = j.Hookable,

  db, User;

describe('hooks', function() {

  before(function(done) {
    db = getSchema();

    User = db.define('User', {
      email: { type: String, index: true },
      name: String,
      password: String,
      state: String,
    });

    db.automigrate('User', done);
  });

  describe('initialize', function() {

    afterEach(function() {
      User.afterInitialize = null;
    });

    it('should be triggered on new', function(done) {
      User.afterInitialize = function() {
        done();
      };
      new User;
    });

    it('should be triggered on create', function(done) {
      var user;
      User.afterInitialize = function() {
        if (this.name === 'Nickolay') {
          this.name += ' Rozental';
        }
      };
      User.create({ name: 'Nickolay' }, function(err, u) {
        u.id.should.be.ok;
        u.name.should.equal('Nickolay Rozental');
        done();
      });
    });

  });
});

function addHooks(name, done) {
  var called = false, random = String(Math.floor(Math.random() * 1000));
  User['before' + name] = function(next, data) {
    called = true;
    data.email = random;
    next();
  };
  User['after' + name] = function(next) {
    (new Boolean(called)).should.equal(true);
    this.should.have.property('email', random);
    done();
  };
}

function removeHooks(name) {
  return function() {
    User['after' + name] = null;
  };
}
