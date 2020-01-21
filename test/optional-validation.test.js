// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
const async = require('async');
const should = require('./init.js');
let db, User, options, ModelWithForceId, whereCount = 0;
const j = require('../');
const ValidationError = j.ValidationError;

const INITIAL_NAME = 'Bert';
const NEW_NAME = 'Ernie';
const INVALID_DATA = {name: null};
const VALID_DATA = {name: INITIAL_NAME};

describe('optional-validation', function() {
  before(function(done) {
    db = getSchema();
    ModelWithForceId = db.createModel(
      'ModelWithForceId',
      {name: String},
      {forceId: true},
    );
    User = db.define('User', {
      seq: {type: Number, index: true},
      name: {type: String, index: true, sort: true},
      email: {type: String, index: true},
      birthday: {type: Date, index: true},
      role: {type: String, index: true},
      order: {type: Number, index: true, sort: true},
      vip: {type: Boolean},
    }, {forceId: true, strict: true});
    db.automigrate(['ModelWithForceId', 'User'], done);
  });

  beforeEach(function(done) {
    User.destroyAll(function() {
      delete User.validations;
      User.validatesPresenceOf('name');
      done();
    });
  });

  function expectValidationError(done) {
    return function(err, result) {
      should.exist(err);
      err.should.be.instanceOf(Error);
      err.should.be.instanceOf(ValidationError);
      done();
    };
  }

  function expectCreateSuccess(data, done) {
    if (done === undefined && typeof data === 'function') {
      done = data;
      data = {name: INITIAL_NAME};
    }
    return function(err, instance) {
      if (err) return done(err);
      instance.should.be.instanceOf(User);
      if (data.name) {
        instance.name.should.eql(data.name || INITIAL_NAME);
      } else {
        should.not.exist(instance.name);
      }
      done();
    };
  }

  function expectChangeSuccess(data, done) {
    if (done === undefined && typeof data === 'function') {
      done = data;
      data = {name: NEW_NAME};
    }
    return function(err, instance) {
      if (err) return done(err);
      instance.should.be.instanceOf(User);
      if (data.name) {
        instance.name.should.eql(data.name || NEW_NAME);
      } else {
        should.not.exist(instance.name);
      }
      done();
    };
  }

  function createUserAndChangeName(name, cb) {
    User.create(VALID_DATA, {validate: true}, function(err, d) {
      d.name = name;
      cb(err, d);
    });
  }

  function createUser(cb) {
    User.create(VALID_DATA, {validate: true}, cb);
  }

  function callUpdateOrCreateWithExistingUserId(name, options, cb) {
    User.create({'name': 'Groover'}, function(err, user) {
      if (err) return cb(err);
      const data = {name: name};
      data.id = user.id;
      User.updateOrCreate(data, options, cb);
    });
  }

  function getNewWhere() {
    return {name: 'DoesNotExist' + (whereCount++)};
  }

  describe('forceId', function() {
    context('replaceAttributes', function() {
      it('should not fail if you do not pass the Primary key in data object',
        function(done) {
          ModelWithForceId.create({name: 'foo'}, function(err, created) {
            if (err) return done(err);
            created.replaceAttributes({name: 'bar'}, function(err, data) {
              done(err);
            });
          });
        });

      it('should fail if you pass the Primary key in data object',
        function(done) {
          ModelWithForceId.create({name: 'foo'}, function(err, created) {
            if (err) return done(err);
            created.replaceAttributes({name: 'bar', id: 999},
              function(err, data) {
                should.exist(err);
                done();
              });
          });
        });
    });
  });

  describe('no model setting', function() {
    describe('method create', function() {
      it('should throw on create with validate:true with invalid data', function(done) {
        User.create(INVALID_DATA, {validate: true}, expectValidationError(done));
      });

      it('should NOT throw on create with validate:false with invalid data', function(done) {
        User.create(INVALID_DATA, {validate: false}, expectCreateSuccess(INVALID_DATA, done));
      });

      it('should NOT throw on create with validate:true with valid data', function(done) {
        User.create(VALID_DATA, {validate: true}, expectCreateSuccess(done));
      });

      it('should NOT throw on create with validate:false with valid data', function(done) {
        User.create(VALID_DATA, {validate: false}, expectCreateSuccess(done));
      });

      it('should throw on create with invalid data', function(done) {
        User.create(INVALID_DATA, expectValidationError(done));
      });

      it('should NOT throw on create with valid data', function(done) {
        User.create(VALID_DATA, expectCreateSuccess(done));
      });
    });

    describe('method findOrCreate', function() {
      it('should throw on findOrCreate with validate:true with invalid data',
        function(done) {
          User.findOrCreate(getNewWhere(), INVALID_DATA, {validate: true},
            expectValidationError(done));
        });

      it('should NOT throw on findOrCreate with validate:false with invalid data',
        function(done) {
          User.findOrCreate(getNewWhere(), INVALID_DATA, {validate: false},
            expectCreateSuccess(INVALID_DATA, done));
        });

      it('should NOT throw on findOrCreate with validate:true with valid data',
        function(done) {
          User.findOrCreate(getNewWhere(), VALID_DATA, {validate: true},
            expectCreateSuccess(done));
        });

      it('should NOT throw on findOrCreate with validate:false with valid data',
        function(done) {
          User.findOrCreate(getNewWhere(), VALID_DATA, {validate: false},
            expectCreateSuccess(done));
        });

      it('should throw on findOrCreate with invalid data', function(done) {
        User.findOrCreate(getNewWhere(), INVALID_DATA, expectValidationError(done));
      });

      it('should NOT throw on findOrCreate with valid data', function(done) {
        User.findOrCreate(getNewWhere(), VALID_DATA, expectCreateSuccess(done));
      });
    });

    describe('method updateOrCreate on existing data', function() {
      it('should throw on updateOrCreate(id) with validate:true with invalid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(null, {validate: true},
            expectValidationError(done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:false with invalid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(null, {validate: false},
            expectChangeSuccess(INVALID_DATA, done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:true with valid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(NEW_NAME, {validate: true},
            expectChangeSuccess(done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:false with valid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(NEW_NAME, {validate: false},
            expectChangeSuccess(done));
        });

      // backwards compatible with validateUpsert
      it('should NOT throw on updateOrCreate(id) with invalid data', function(done) {
        callUpdateOrCreateWithExistingUserId(null, expectChangeSuccess(INVALID_DATA, done));
      });

      it('should NOT throw on updateOrCreate(id) with valid data', function(done) {
        callUpdateOrCreateWithExistingUserId(NEW_NAME, expectChangeSuccess(done));
      });
    });

    describe('method save', function() {
      it('should throw on save with {validate:true} with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save({validate: true}, expectValidationError(done));
        });
      });

      it('should NOT throw on save with {validate:false} with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save({validate: false}, expectChangeSuccess(INVALID_DATA, done));
        });
      });

      it('should NOT throw on save with {validate:true} with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save({validate: true}, expectChangeSuccess(done));
        });
      });

      it('should NOT throw on save with {validate:false} with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save({validate: false}, expectChangeSuccess(done));
        });
      });

      it('should throw on save(cb) with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save(expectValidationError(done));
        });
      });

      it('should NOT throw on save(cb) with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save(expectChangeSuccess(done));
        });
      });
    });

    describe('method updateAttributes', function() {
      it('should throw on updateAttributes with {validate:true} with invalid data', function(done) {
        createUser(function(err, d) {
          d.updateAttributes(INVALID_DATA, {validate: true}, expectValidationError(done));
        });
      });

      it('should NOT throw on updateAttributes with {validate:false} with invalid data', function(done) {
        createUser(function(err, d) {
          d.updateAttributes(INVALID_DATA, {validate: false}, expectChangeSuccess(INVALID_DATA, done));
        });
      });

      it('should NOT throw on updateAttributes with {validate:true} with valid data', function(done) {
        createUser(function(err, d) {
          d.updateAttributes({'name': NEW_NAME}, {validate: true}, expectChangeSuccess(done));
        });
      });

      it('should NOT throw on updateAttributes with {validate:false} with valid data', function(done) {
        createUser(function(err, d) {
          d.updateAttributes({'name': NEW_NAME}, {validate: false}, expectChangeSuccess(done));
        });
      });

      it('should throw on updateAttributes(cb) with invalid data', function(done) {
        createUser(function(err, d) {
          d.updateAttributes(INVALID_DATA, expectValidationError(done));
        });
      });

      it('should NOT throw on updateAttributes(cb) with valid data', function(done) {
        createUser(function(err, d) {
          d.updateAttributes({'name': NEW_NAME}, expectChangeSuccess(done));
        });
      });

      it('returns an error when trying to update the id property when forceId is set to true',
        function(done) {
          ModelWithForceId.create({name: 'foo'}, function(err, model) {
            if (err) return done(err);
            model.updateAttributes({id: 123}, function(err) {
              err.should.be.instanceOf(Error);
              err.message.should.eql('id cannot be updated from ' + model.id +
              ' to 123 when forceId is set to true');
              done();
            });
          });
        });
    });
  });

  describe('model setting: automaticValidation: false', function() {
    before(function(done) {
      User.settings.automaticValidation = false;
      done();
    });

    describe('method create', function() {
      it('should throw on create with validate:true with invalid data', function(done) {
        User.create(INVALID_DATA, {validate: true}, expectValidationError(done));
      });

      it('should NOT throw on create with validate:false with invalid data', function(done) {
        User.create(INVALID_DATA, {validate: false}, expectCreateSuccess(INVALID_DATA, done));
      });

      it('should NOT throw on create with validate:true with valid data', function(done) {
        User.create(VALID_DATA, {validate: true}, expectCreateSuccess(done));
      });

      it('should NOT throw on create with validate:false with valid data', function(done) {
        User.create(VALID_DATA, {validate: false}, expectCreateSuccess(done));
      });

      it('should NOT throw on create with invalid data', function(done) {
        User.create(INVALID_DATA, expectCreateSuccess(INVALID_DATA, done));
      });

      it('should NOT throw on create with valid data', function(done) {
        User.create(VALID_DATA, expectCreateSuccess(done));
      });
    });

    describe('method findOrCreate', function() {
      it('should throw on findOrCreate with validate:true with invalid data',
        function(done) {
          User.findOrCreate(getNewWhere(), INVALID_DATA, {validate: true},
            expectValidationError(done));
        });

      it('should NOT throw on findOrCreate with validate:false with invalid data',
        function(done) {
          User.findOrCreate(getNewWhere(), INVALID_DATA, {validate: false},
            expectCreateSuccess(INVALID_DATA, done));
        });

      it('should NOT throw on findOrCreate with validate:true with valid data',
        function(done) {
          User.findOrCreate(getNewWhere(), VALID_DATA, {validate: true},
            expectCreateSuccess(done));
        });

      it('should NOT throw on findOrCreate with validate:false with valid data',
        function(done) {
          User.findOrCreate(getNewWhere(), VALID_DATA, {validate: false},
            expectCreateSuccess(done));
        });

      it('should NOT throw on findOrCreate with invalid data', function(done) {
        User.findOrCreate(getNewWhere(), INVALID_DATA,
          expectCreateSuccess(INVALID_DATA, done));
      });

      it('should NOT throw on findOrCreate with valid data', function(done) {
        User.findOrCreate(getNewWhere(), VALID_DATA, expectCreateSuccess(done));
      });
    });

    describe('method updateOrCreate on existing data', function() {
      it('should throw on updateOrCreate(id) with validate:true with invalid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(null, {validate: true},
            expectValidationError(done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:false with invalid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(null, {validate: false},
            expectChangeSuccess(INVALID_DATA, done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:true with valid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(NEW_NAME, {validate: true},
            expectChangeSuccess(done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:false with valid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(NEW_NAME, {validate: false},
            expectChangeSuccess(done));
        });

      it('should NOT throw on updateOrCreate(id) with invalid data', function(done) {
        callUpdateOrCreateWithExistingUserId(null, expectChangeSuccess(INVALID_DATA, done));
      });

      it('should NOT throw on updateOrCreate(id) with valid data', function(done) {
        callUpdateOrCreateWithExistingUserId(NEW_NAME, expectChangeSuccess(done));
      });
    });

    describe('method save', function() {
      it('should throw on save with {validate:true} with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save({validate: true}, expectValidationError(done));
        });
      });

      it('should NOT throw on save with {validate:false} with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save({validate: false}, expectChangeSuccess(INVALID_DATA, done));
        });
      });

      it('should NOT throw on save with {validate:true} with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save({validate: true}, expectChangeSuccess(done));
        });
      });

      it('should NOT throw on save with {validate:false} with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save({validate: false}, expectChangeSuccess(done));
        });
      });

      it('should NOT throw on save(cb) with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save(expectChangeSuccess(INVALID_DATA, done));
        });
      });

      it('should NOT throw on save(cb) with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save(expectChangeSuccess(done));
        });
      });
    });
  });

  describe('model setting: automaticValidation: true', function() {
    before(function(done) {
      User.settings.automaticValidation = true;
      done();
    });

    describe('method create', function() {
      it('should throw on create with validate:true with invalid data', function(done) {
        User.create(INVALID_DATA, {validate: true}, expectValidationError(done));
      });

      it('should NOT throw on create with validate:false with invalid data', function(done) {
        User.create(INVALID_DATA, {validate: false}, expectCreateSuccess(INVALID_DATA, done));
      });

      it('should NOT throw on create with validate:true with valid data', function(done) {
        User.create(VALID_DATA, {validate: true}, expectCreateSuccess(done));
      });

      it('should NOT throw on create with validate:false with valid data', function(done) {
        User.create(VALID_DATA, {validate: false}, expectCreateSuccess(done));
      });

      it('should throw on create with invalid data', function(done) {
        User.create(INVALID_DATA, expectValidationError(done));
      });

      it('should NOT throw on create with valid data', function(done) {
        User.create(VALID_DATA, expectCreateSuccess(done));
      });
    });

    describe('method findOrCreate', function() {
      it('should throw on findOrCreate with validate:true with invalid data',
        function(done) {
          User.findOrCreate(getNewWhere(), INVALID_DATA, {validate: true},
            expectValidationError(done));
        });

      it('should NOT throw on findOrCreate with validate:false with invalid data',
        function(done) {
          User.findOrCreate(getNewWhere(), INVALID_DATA, {validate: false},
            expectCreateSuccess(INVALID_DATA, done));
        });

      it('should NOT throw on findOrCreate with validate:true with valid data',
        function(done) {
          User.findOrCreate(getNewWhere(), VALID_DATA, {validate: true},
            expectCreateSuccess(done));
        });

      it('should NOT throw on findOrCreate with validate:false with valid data',
        function(done) {
          User.findOrCreate(getNewWhere(), VALID_DATA, {validate: false},
            expectCreateSuccess(done));
        });

      it('should throw on findOrCreate with invalid data', function(done) {
        User.findOrCreate(getNewWhere(), INVALID_DATA, expectValidationError(done));
      });

      it('should NOT throw on findOrCreate with valid data', function(done) {
        User.findOrCreate(getNewWhere(), VALID_DATA, expectCreateSuccess(done));
      });
    });

    describe('method updateOrCreate on existing data', function() {
      it('should throw on updateOrCreate(id) with validate:true with invalid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(null, {validate: true},
            expectValidationError(done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:false with invalid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(null, {validate: false},
            expectChangeSuccess(INVALID_DATA, done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:true with valid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(NEW_NAME, {validate: true},
            expectChangeSuccess(done));
        });

      it('should NOT throw on updateOrCreate(id) with validate:false with valid data',
        function(done) {
          callUpdateOrCreateWithExistingUserId(NEW_NAME, {validate: false},
            expectChangeSuccess(done));
        });

      it('should throw on updateOrCreate(id) with invalid data', function(done) {
        callUpdateOrCreateWithExistingUserId(null, expectValidationError(done));
      });

      it('should NOT throw on updateOrCreate(id) with valid data', function(done) {
        callUpdateOrCreateWithExistingUserId(NEW_NAME, expectChangeSuccess(done));
      });
    });

    describe('method save', function() {
      it('should throw on save with {validate:true} with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save(options, expectValidationError(done));
        });
      });

      it('should NOT throw on save with {validate:false} with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save({validate: false}, expectChangeSuccess(INVALID_DATA, done));
        });
      });

      it('should NOT throw on save with {validate:true} with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save({validate: true}, expectChangeSuccess(done));
        });
      });

      it('should NOT throw on save with {validate:false} with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save({validate: false}, expectChangeSuccess(done));
        });
      });

      it('should throw on save(cb) with invalid data', function(done) {
        createUserAndChangeName(null, function(err, d) {
          d.save(expectValidationError(done));
        });
      });

      it('should NOT throw on save(cb) with valid data', function(done) {
        createUserAndChangeName(NEW_NAME, function(err, d) {
          d.save(expectChangeSuccess(done));
        });
      });
    });
  });
});
