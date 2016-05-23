// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
var should = require('./init.js');
var async = require('async');

var j = require('../'), db, User;
var ValidationError = j.ValidationError;

function getValidAttributes() {
  return {
    name: 'Anatoliy',
    email: 'email@example.com',
    state: '',
    age: 26,
    gender: 'male',
    createdByAdmin: false,
    createdByScript: true,
  };
}

describe('validations', function() {
  var User, Entry;

  before(function(done) {
    db = getSchema();
    User = db.define('User', {
      email: String,
      name: String,
      password: String,
      state: String,
      age: Number,
      gender: String,
      domain: String,
      pendingPeriod: Number,
      createdByAdmin: Boolean,
      createdByScript: Boolean,
      updatedAt: Date,
    });
    Entry = db.define('Entry', {
      id: { type: 'string', id: true, generated: false },
      name: { type: 'string' },
    });
    Entry.validatesUniquenessOf('id');
    db.automigrate(done);
  });

  beforeEach(function(done) {
    User.destroyAll(function() {
      delete User.validations;
      done();
    });
  });

  after(function() {
    // db.disconnect();
  });

  describe('commons', function() {
    describe('skipping', function() {
      it('should NOT skip when `if` is fulfilled', function() {
        User.validatesPresenceOf('pendingPeriod', { if: 'createdByAdmin' });
        var user = new User;
        user.createdByAdmin = true;
        user.isValid().should.be.false;
        user.errors.pendingPeriod.should.eql(['can\'t be blank']);
        user.pendingPeriod = 1;
        user.isValid().should.be.true;
      });

      it('should skip when `if` is NOT fulfilled', function() {
        User.validatesPresenceOf('pendingPeriod', { if: 'createdByAdmin' });
        var user = new User;
        user.createdByAdmin = false;
        user.isValid().should.be.true;
        user.errors.should.be.false;
        user.pendingPeriod = 1;
        user.isValid().should.be.true;
      });

      it('should NOT skip when `unless` is fulfilled', function() {
        User.validatesPresenceOf('pendingPeriod', { unless: 'createdByAdmin' });
        var user = new User;
        user.createdByAdmin = false;
        user.isValid().should.be.false;
        user.errors.pendingPeriod.should.eql(['can\'t be blank']);
        user.pendingPeriod = 1;
        user.isValid().should.be.true;
      });

      it('should skip when `unless` is NOT fulfilled', function() {
        User.validatesPresenceOf('pendingPeriod', { unless: 'createdByAdmin' });
        var user = new User;
        user.createdByAdmin = true;
        user.isValid().should.be.true;
        user.errors.should.be.false;
        user.pendingPeriod = 1;
        user.isValid().should.be.true;
      });
    });

    describe('skipping in async validation', function() {
      it('should skip when `if` is NOT fulfilled', function(done) {
        User.validateAsync('pendingPeriod', function(err, done) {
          if (!this.pendingPeriod) err();
          done();
        }, { if: 'createdByAdmin', code: 'presence', message: 'can\'t be blank' });
        var user = new User;
        user.createdByAdmin = false;
        user.isValid(function(valid) {
          valid.should.be.true;
          user.errors.should.be.false;
          done();
        });
      });

      it('should NOT skip when `if` is fulfilled', function(done) {
        User.validateAsync('pendingPeriod', function(err, done) {
          if (!this.pendingPeriod) err();
          done();
        }, { if: 'createdByAdmin', code: 'presence', message: 'can\'t be blank' });
        var user = new User;
        user.createdByAdmin = true;
        user.isValid(function(valid) {
          valid.should.be.false;
          user.errors.pendingPeriod.should.eql(['can\'t be blank']);
          done();
        });
      });

      it('should skip when `unless` is NOT fulfilled', function(done) {
        User.validateAsync('pendingPeriod', function(err, done) {
          if (!this.pendingPeriod) err();
          done();
        }, { unless: 'createdByAdmin', code: 'presence', message: 'can\'t be blank' });
        var user = new User;
        user.createdByAdmin = true;
        user.isValid(function(valid) {
          valid.should.be.true;
          user.errors.should.be.false;
          done();
        });
      });

      it('should NOT skip when `unless` is fulfilled', function(done) {
        User.validateAsync('pendingPeriod', function(err, done) {
          if (!this.pendingPeriod) err();
          done();
        }, { unless: 'createdByAdmin', code: 'presence', message: 'can\'t be blank' });
        var user = new User;
        user.createdByAdmin = false;
        user.isValid(function(valid) {
          valid.should.be.false;
          user.errors.pendingPeriod.should.eql(['can\'t be blank']);
          done();
        });
      });
    });

    describe('lifecycle', function() {
      it('should work on create', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        User.create(function(e, u) {
          should.exist(e);
          User.create({ name: 'Valid' }, function(e, d) {
            should.not.exist(e);
            done();
          });
        });
      });

      it('should work on update', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        User.create({ name: 'Valid' }, function(e, d) {
          d.updateAttribute('name', null, function(e) {
            should.exist(e);
            e.should.be.instanceOf(Error);
            e.should.be.instanceOf(ValidationError);
            d.updateAttribute('name', 'Vasiliy', function(e) {
              should.not.exist(e);
              done();
            });
          });
        });
      });

      it('should ignore errors on upsert by default', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        // It's important to pass an id value, otherwise DAO falls back
        // to regular create()
        User.updateOrCreate({ id: 999 }, done);
      });

      it('should be skipped by upsert when disabled via settings', function(done) {
        var Customer = User.extend('Customer');
        Customer.attachTo(db);
        db.autoupdate(function(err) {
          if (err) return done(err);
          Customer.prototype.isValid = function() {
            throw new Error('isValid() should not be called at all');
          };
          Customer.settings.validateUpsert = false;
          // It's important to pass an id value, otherwise DAO falls back
          // to regular create()
          Customer.updateOrCreate({ id: 999 }, done);
        });
      });

      it('should work on upsert when enabled via settings', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        User.settings.validateUpsert = true;
        // It's important to pass an id value, otherwise DAO falls back
        // to regular create()
        User.upsert({ id: 999 }, function(err, u) {
          if (!err) return done(new Error('Validation should have failed.'));
          err.should.be.instanceOf(ValidationError);
          done();
        });
      });

      it('should return error code', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        User.create(function(e, u) {
          should.exist(e);
          e.details.codes.name.should.eql(['presence']);
          done();
        });
      });

      it('should allow to modify error after validation', function(done) {
        User.afterValidate = function(next) {
          next();
        };
        done();
      });

      it('should include validation messages in err.message', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        User.create(function(e, u) {
          should.exist(e);
          e.message.should.match(/`name` can't be blank/);
          done();
        });
      });

      it('should include property value in err.message', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        User.create(function(e, u) {
          should.exist(e);
          e.message.should.match(/`name` can't be blank \(value: undefined\)/);
          done();
        });
      });

      it('should include model name in err.message', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        User.create(function(e, u) {
          should.exist(e);
          e.message.should.match(/`User` instance/i);
          done();
        });
      });

      it('should return validation metadata', function() {
        var expected = { name: [{ validation: 'presence', options: {}}] };
        delete User.validations;
        User.validatesPresenceOf('name');
        var validations = User.validations;
        validations.should.eql(expected);
      });
    });
  });

  describe('presence', function() {
    it('should validate presence', function() {
      User.validatesPresenceOf('name', 'email');

      var validations = User.validations;
      validations.name.should.eql([{ validation: 'presence', options: {}}]);
      validations.email.should.eql([{ validation: 'presence', options: {}}]);

      var u = new User;
      u.isValid().should.not.be.true;
      u.name = 1;
      u.isValid().should.not.be.true;
      u.email = 2;
      u.isValid().should.be.true;
    });

    it('should reject NaN value as a number', function() {
      User.validatesPresenceOf('age');
      var u = new User();
      u.isValid().should.be.false;
      u.age = NaN;
      u.isValid().should.be.false;
      u.age = 1;
      u.isValid().should.be.true;
    });

    it('should allow "NaN" value as a string', function() {
      User.validatesPresenceOf('name');
      var u = new User();
      u.isValid().should.be.false;
      u.name = 'NaN';
      u.isValid().should.be.true;
    });

    it('should skip validation by property (if/unless)', function() {
      User.validatesPresenceOf('domain', { unless: 'createdByScript' });

      var user = new User(getValidAttributes());
      user.isValid().should.be.true;

      user.createdByScript = false;
      user.isValid().should.be.false;
      user.errors.domain.should.eql(['can\'t be blank']);

      user.domain = 'domain';
      user.isValid().should.be.true;
    });
  });

  describe('absence', function() {
    it('should validate absence', function() {
      User.validatesAbsenceOf('reserved', { if: 'locked' });
      var u = new User({ reserved: 'foo', locked: true });
      u.isValid().should.not.be.true;
      u.reserved = null;
      u.isValid().should.be.true;
      var u = new User({ reserved: 'foo', locked: false });
      u.isValid().should.be.true;
    });
  });

  describe('uniqueness', function() {
    it('should validate uniqueness', function(done) {
      User.validatesUniquenessOf('email');
      var u = new User({ email: 'hey' });
      Boolean(u.isValid(function(valid) {
        valid.should.be.true;
        u.save(function() {
          var u2 = new User({ email: 'hey' });
          u2.isValid(function(valid) {
            valid.should.be.false;
            done();
          });
        });
      })).should.be.false;
    });

    it('should handle same object modification', function(done) {
      User.validatesUniquenessOf('email');
      var u = new User({ email: 'hey' });
      Boolean(u.isValid(function(valid) {
        valid.should.be.true;
        u.save(function() {
          u.name = 'Goghi';
          u.isValid(function(valid) {
            valid.should.be.true;
            u.save(done);
          });
        });
        // async validations always falsy when called as sync
      })).should.not.be.ok;
    });

    it('should support multi-key constraint', function(done) {
      var EMAIL = 'user@xample.com';
      var SiteUser = db.define('SiteUser', {
        siteId: String,
        email: String,
      });
      SiteUser.validatesUniquenessOf('email', { scopedTo: ['siteId'] });
      async.waterfall([
        function automigrate(next) {
          db.automigrate(next);
        },
        function createSite1User(next) {
          SiteUser.create(
            { siteId: 1, email: EMAIL },
            next);
        },
        function createSite2User(user1, next) {
          SiteUser.create(
            { siteId: 2, email: EMAIL },
            next);
        },
        function validateDuplicateUser(user2, next) {
          var user3 = new SiteUser({ siteId: 1, email: EMAIL });
          user3.isValid(function(valid) {
            valid.should.be.false;
            next();
          });
        },
      ], function(err) {
        if (err && err.name == 'ValidationError') {
          console.error('ValidationError:', err.details.messages);
        }
        done(err);
      });
    });

    it('should skip blank values', function(done) {
      User.validatesUniquenessOf('email');
      var u = new User({ email: '  ' });
      Boolean(u.isValid(function(valid) {
        valid.should.be.true;
        u.save(function() {
          var u2 = new User({ email: null });
          u2.isValid(function(valid) {
            valid.should.be.true;
            done();
          });
        });
      })).should.be.false;
    });

    it('should work with if/unless', function(done) {
      User.validatesUniquenessOf('email', {
        if: function() { return true; },
        unless: function() { return false; },
      });
      var u = new User({ email: 'hello' });
      Boolean(u.isValid(function(valid) {
        valid.should.be.true;
        done();
      })).should.be.false;
    });

    it('should work with id property on create', function(done) {
      Entry.create({ id: 'entry' }, function(err, entry) {
        var e = new Entry({ id: 'entry' });
        Boolean(e.isValid(function(valid) {
          valid.should.be.false;
          done();
        })).should.be.false;
      });
    });

    it('should work with id property after create', function(done) {
      Entry.findById('entry', function(err, e) {
        Boolean(e.isValid(function(valid) {
          valid.should.be.true;
          done();
        })).should.be.false;
      });
    });
  });

  describe('format', function() {
    it('should validate format');
    it('should overwrite default blank message with custom format message');

    it('should skip missing values when allowing null', function() {
      User.validatesFormatOf('email', { with: /^\S+@\S+\.\S+$/, allowNull: true });
      var u = new User({});
      u.isValid().should.be.true;
    });

    it('should skip null values when allowing null', function() {
      User.validatesFormatOf('email', { with: /^\S+@\S+\.\S+$/, allowNull: true });
      var u = new User({ email: null });
      u.isValid().should.be.true;
    });

    it('should not skip missing values', function() {
      User.validatesFormatOf('email', { with: /^\S+@\S+\.\S+$/ });
      var u = new User({});
      u.isValid().should.be.false;
    });

    it('should not skip null values', function() {
      User.validatesFormatOf('email', { with: /^\S+@\S+\.\S+$/ });
      var u = new User({ email: null });
      u.isValid().should.be.false;
    });
  });

  describe('numericality', function() {
    it('should validate numericality');
  });

  describe('inclusion', function() {
    it('should validate inclusion');
  });

  describe('exclusion', function() {
    it('should validate exclusion');
  });

  describe('length', function() {
    it('should validate length');
  });

  describe('custom', function() {
    it('should validate using custom sync validation', function() {
      User.validate('email', function(err) {
        if (this.email === 'hello') err();
      }, { code: 'invalid-email' });
      var u = new User({ email: 'hello' });
      Boolean(u.isValid()).should.be.false;
      u.errors.codes.should.eql({ email: ['invalid-email'] });
    });

    it('should validate and return detailed error messages', function() {
      User.validate('global', function(err) {
        if (this.email === 'hello' || this.email === 'hey') {
          this.errors.add('email', 'Cannot be `' + this.email + '`', 'invalid-email');
          err(false); // false: prevent global error message
        }
      });
      var u = new User({ email: 'hello' });
      Boolean(u.isValid()).should.be.false;
      u.errors.should.eql({ email: ['Cannot be `hello`'] });
      u.errors.codes.should.eql({ email: ['invalid-email'] });
    });

    it('should validate using custom async validation', function(done) {
      User.validateAsync('email', function(err, next) {
        process.nextTick(next);
      }, {
        if: function() { return true; },
        unless: function() { return false; },
      });
      var u = new User({ email: 'hello' });
      Boolean(u.isValid(function(valid) {
        valid.should.be.true;
        done();
      })).should.be.false;
    });
  });

  describe('invalid value formatting', function() {
    var origMaxLen;
    beforeEach(function saveAndSetMaxLen() {
      origMaxLen = ValidationError.maxPropertyStringLength;
    });

    afterEach(function restoreMaxLen() {
      ValidationError.maxPropertyStringLength = origMaxLen;
    });

    it('should truncate long strings', function() {
      ValidationError.maxPropertyStringLength = 9;
      var err = givenValidationError('prop', '1234567890abc', 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: "12...abc").');
    });

    it('should truncate long objects', function() {
      ValidationError.maxPropertyStringLength = 12;
      var err = givenValidationError('prop', { foo: 'bar' }, 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: { foo:... }).');
    });

    it('should truncate long arrays', function() {
      ValidationError.maxPropertyStringLength = 12;
      var err = givenValidationError('prop', [{ a: 1, b: 2 }], 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: [ { a...} ]).');
    });

    it('should print only top-level object properties', function() {
      var err = givenValidationError('prop', { a: { b: 'c' }}, 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: { a: [Object] }).');
    });

    it('should print only top-level props of objects in array', function() {
      var err = givenValidationError('prop', [{ a: { b: 'c' }}], 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: [ { a: [Object] } ]).');
    });

    it('should exclude colors from Model values', function() {
      var obj = new User();
      obj.email = 'test@example.com';
      var err = givenValidationError('user', obj, 'is invalid');
      getErrorDetails(err).should.equal(
        '`user` is invalid (value: { email: \'test@example.com\' }).');
    });

    function givenValidationError(propertyName, propertyValue, errorMessage) {
      var jsonVal = {};
      jsonVal[propertyName] = propertyValue;
      var errorVal = {};
      errorVal[propertyName] = [errorMessage];

      var obj = {
        errors: errorVal,
        toJSON: function() { return jsonVal; },
      };
      return new ValidationError(obj);
    }

    function getErrorDetails(err) {
      return err.message.replace(/^.*Details: /, '');
    }
  });
});
