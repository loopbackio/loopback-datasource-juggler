// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
const should = require('./init.js');
const async = require('async');

const j = require('../');
let db, User;
const ValidationError = j.ValidationError;

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
  let User, Entry, Employee;

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
      id: {type: 'string', id: true, generated: false},
      name: {type: 'string'},
    });
    Employee = db.define('Employee', {
      id: {type: Number, id: true, generated: false},
      name: {type: String},
      age: {type: Number},
    }, {
      validateUpdate: true,
    });
    Entry.validatesUniquenessOf('id');
    db.automigrate(function(err) {
      should.not.exist(err);
      Employee.create(empData, done);
    });
  });

  beforeEach(function(done) {
    User.destroyAll(function() {
      delete User.validations;
      done();
    });
  });

  after(function(done) {
    Employee.destroyAll(done);
  });

  describe('commons', function() {
    describe('skipping', function() {
      it('should NOT skip when `if` is fulfilled', function() {
        User.validatesPresenceOf('pendingPeriod', {if: 'createdByAdmin'});
        const user = new User;
        user.createdByAdmin = true;
        user.isValid().should.be.false();
        user.errors.pendingPeriod.should.eql(['can\'t be blank']);
        user.pendingPeriod = 1;
        user.isValid().should.be.true();
      });

      it('should skip when `if` is NOT fulfilled', function() {
        User.validatesPresenceOf('pendingPeriod', {if: 'createdByAdmin'});
        const user = new User;
        user.createdByAdmin = false;
        user.isValid().should.be.true();
        user.errors.should.be.false();
        user.pendingPeriod = 1;
        user.isValid().should.be.true();
      });

      it('should NOT skip when `unless` is fulfilled', function() {
        User.validatesPresenceOf('pendingPeriod', {unless: 'createdByAdmin'});
        const user = new User;
        user.createdByAdmin = false;
        user.isValid().should.be.false();
        user.errors.pendingPeriod.should.eql(['can\'t be blank']);
        user.pendingPeriod = 1;
        user.isValid().should.be.true();
      });

      it('should skip when `unless` is NOT fulfilled', function() {
        User.validatesPresenceOf('pendingPeriod', {unless: 'createdByAdmin'});
        const user = new User;
        user.createdByAdmin = true;
        user.isValid().should.be.true();
        user.errors.should.be.false();
        user.pendingPeriod = 1;
        user.isValid().should.be.true();
      });
    });

    describe('skipping in async validation', function() {
      it('should skip when `if` is NOT fulfilled', function(done) {
        User.validateAsync('pendingPeriod', function(err, done) {
          if (!this.pendingPeriod) err();
          done();
        }, {if: 'createdByAdmin', code: 'presence', message: 'can\'t be blank'});
        const user = new User;
        user.createdByAdmin = false;
        user.isValid(function(valid) {
          valid.should.be.true();
          user.errors.should.be.false();
          done();
        });
      });

      it('should NOT skip when `if` is fulfilled', function(done) {
        User.validateAsync('pendingPeriod', function(err, done) {
          if (!this.pendingPeriod) err();
          done();
        }, {if: 'createdByAdmin', code: 'presence', message: 'can\'t be blank'});
        const user = new User;
        user.createdByAdmin = true;
        user.isValid(function(valid) {
          valid.should.be.false();
          user.errors.pendingPeriod.should.eql(['can\'t be blank']);
          done();
        });
      });

      it('should skip when `unless` is NOT fulfilled', function(done) {
        User.validateAsync('pendingPeriod', function(err, done) {
          if (!this.pendingPeriod) err();
          done();
        }, {unless: 'createdByAdmin', code: 'presence', message: 'can\'t be blank'});
        const user = new User;
        user.createdByAdmin = true;
        user.isValid(function(valid) {
          valid.should.be.true();
          user.errors.should.be.false();
          done();
        });
      });

      it('should NOT skip when `unless` is fulfilled', function(done) {
        User.validateAsync('pendingPeriod', function(err, done) {
          if (!this.pendingPeriod) err();
          done();
        }, {unless: 'createdByAdmin', code: 'presence', message: 'can\'t be blank'});
        const user = new User;
        user.createdByAdmin = false;
        user.isValid(function(valid) {
          valid.should.be.false();
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
          User.create({name: 'Valid'}, function(e, d) {
            should.not.exist(e);
            done();
          });
        });
      });

      it('should work on update', function(done) {
        delete User.validations;
        User.validatesPresenceOf('name');
        User.create({name: 'Valid'}, function(e, d) {
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
        // It's important to pass an existing id value to updateOrCreate,
        // otherwise DAO falls back to regular create()
        User.create({name: 'a-name'}, (err, u) => {
          if (err) return done(err);
          User.updateOrCreate({id: u.id}, done);
        });
      });

      it('should be skipped by upsert when disabled via settings', function(done) {
        const Customer = User.extend('Customer');
        Customer.attachTo(db);
        db.autoupdate(function(err) {
          if (err) return done(err);
          // It's important to pass an existing id value,
          // otherwise DAO falls back to regular create()
          Customer.create({name: 'a-name'}, (err, u) => {
            if (err) return done(err);

            Customer.prototype.isValid = function() {
              throw new Error('isValid() should not be called at all');
            };
            Customer.settings.validateUpsert = false;

            Customer.updateOrCreate({id: u.id, name: ''}, done);
          });
        });
      });

      it('should work on upsert when enabled via settings', function(done) {
        User.validatesPresenceOf('name');
        User.settings.validateUpsert = true;
        // It's important to pass an existing id value,
        // otherwise DAO falls back to regular create()
        User.create({name: 'a-name'}, (err, u) => {
          if (err) return done(err);
          User.upsert({id: u.id, name: ''}, function(err, u) {
            if (!err) return done(new Error('Validation should have failed.'));
            err.should.be.instanceOf(ValidationError);
            done();
          });
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
        const expected = {name: [{validation: 'presence', options: {}}]};
        delete User.validations;
        User.validatesPresenceOf('name');
        const validations = User.validations;
        validations.should.eql(expected);
      });
    });
  });

  describe('validation with or without options', function() {
    it('should work on update with options', function(done) {
      delete User.validations;
      User.validatesPresenceOf('name');
      User.create({name: 'Valid'}, function(e, d) {
        d.updateAttribute('name', null, {options: 'options'}, function(e) {
          should.exist(e);
          e.should.be.instanceOf(Error);
          e.should.be.instanceOf(ValidationError);
          d.updateAttribute('name', 'Vasiliy', {options: 'options'}, err => {
            if (err) return done(err);
            // test passed
            done();
          });
        });
      });
    });

    it('passes options to custom sync validator', done => {
      delete User.validations;
      User.validate('name', function(err, options) {
        if (options.testFlag !== 'someValue') err();
      });
      User.create({name: 'Valid'}, {testFlag: 'someValue'}, function(e, d) {
        d.updateAttribute('name', null, {testFlag: 'otherValue'}, function(e) {
          should.exist(e);
          e.should.be.instanceOf(ValidationError);
          d.updateAttribute('name', 'Vasiliy', {testFlag: 'someValue'}, err => {
            if (err) return done(err);
            // test passed
            done();
          });
        });
      });
    });

    it('passes options to async validator', done => {
      delete User.validations;
      User.validateAsync('name', function(err, options, done) {
        if (options.testFlag !== 'someValue') {
          console.error(
            'Unexpected validation options: %j Expected %j',
            options, {testFlag: 'someValue'}
          );
          err();
        }
        process.nextTick(function() { done(); });
      });
      User.create({name: 'Valid'}, {testFlag: 'someValue'}, function(e, d) {
        if (e) return done(e);
        d.updateAttribute('name', null, {testFlag: 'otherValue'}, function(e) {
          should.exist(e);
          e.should.be.instanceOf(ValidationError);
          d.updateAttribute('name', 'Vasiliy', {testFlag: 'someValue'}, err => {
            if (err) return done(err);
            // test passed
            done();
          });
        });
      });
    });

    it('should work on update without options', function(done) {
      delete User.validations;
      User.validatesPresenceOf('name');
      User.create({name: 'Valid'}, function(e, d) {
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

    it('should work on create with options', function(done) {
      delete User.validations;
      User.validatesPresenceOf('name');
      User.create(function(e, u) {
        should.exist(e);
        User.create({name: 'Valid'}, {options: 'options'}, function(e, d) {
          should.not.exist(e);
          done();
        });
      });
    });

    it('should work on create without options', function(done) {
      delete User.validations;
      User.validatesPresenceOf('name');
      User.create(function(e, u) {
        should.exist(e);
        User.create({name: 'Valid'}, function(e, d) {
          should.not.exist(e);
          done();
        });
      });
    });
  });

  describe('presence', function() {
    it('should validate presence', function() {
      User.validatesPresenceOf('name', 'email');

      const validations = User.validations;
      validations.name.should.eql([{validation: 'presence', options: {}}]);
      validations.email.should.eql([{validation: 'presence', options: {}}]);

      const u = new User;
      u.isValid().should.not.be.true();
      u.name = 1;
      u.isValid().should.not.be.true();
      u.email = 2;
      u.isValid().should.be.true();
    });

    it('should reject NaN value as a number', function() {
      User.validatesPresenceOf('age');
      const u = new User();
      u.isValid().should.be.false();
      u.age = NaN;
      u.isValid().should.be.false();
      u.age = 1;
      u.isValid().should.be.true();
    });

    it('should allow "NaN" value as a string', function() {
      User.validatesPresenceOf('name');
      const u = new User();
      u.isValid().should.be.false();
      u.name = 'NaN';
      u.isValid().should.be.true();
    });

    it('should skip validation by property (if/unless)', function() {
      User.validatesPresenceOf('domain', {unless: 'createdByScript'});

      const user = new User(getValidAttributes());
      user.isValid().should.be.true();

      user.createdByScript = false;
      user.isValid().should.be.false();
      user.errors.domain.should.eql(['can\'t be blank']);

      user.domain = 'domain';
      user.isValid().should.be.true();
    });

    describe('validate presence on update', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesPresenceOf('name', 'age');
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met', function(done) {
        const data = {name: 'Foo-new', age: 5};
        Employee.updateAll({id: 1}, data,
          function(err, emp) {
            should.not.exist(err);
            should.exist(emp);
            should.equal(emp.count, 1);
            Employee.find({where: {id: 1}}, function(err, emp) {
              should.not.exist(err);
              should.exist(emp);
              data.id = 1;
              should.deepEqual(data, emp[0].toObject());
              done();
            });
          });
      });

      it('throws err when validate condition is not met', function(done) {
        Employee.updateAll({where: {id: 1}}, {name: 'Foo-new'},
          function(err, emp) {
            should.exist(err);
            should.not.exist(emp);
            should.equal(err.statusCode, 422);
            should.equal(err.details.messages.age[0], 'can\'t be blank');
            done();
          });
      });
    });
  });

  describe('absence', function() {
    it('should validate absence', function() {
      User.validatesAbsenceOf('reserved', {if: 'locked'});
      let u = new User({reserved: 'foo', locked: true});
      u.isValid().should.not.be.true();
      u.reserved = null;
      u.isValid().should.be.true();
      u = new User({reserved: 'foo', locked: false});
      u.isValid().should.be.true();
    });

    describe('validate absence on update', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesAbsenceOf('name');
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met', function(done) {
        const data = {age: 5};
        Employee.updateAll({id: 1}, data,
          function(err, emp) {
            should.not.exist(err);
            should.exist(emp);
            should.equal(emp.count, 1);
            Employee.find({where: {id: 1}}, function(err, emp) {
              should.not.exist(err);
              should.exist(emp);
              data.id = 1;
              data.name = 'Foo';
              should.deepEqual(data, emp[0].toObject());
              done();
            });
          });
      });

      it('throws err when validate condition is not met', function(done) {
        Employee.updateAll({where: {id: 1}}, {name: 'Foo-new', age: 5},
          function(err, emp) {
            should.exist(err);
            should.not.exist(emp);
            should.equal(err.statusCode, 422);
            should.equal(err.details.messages.name[0], 'can\'t be set');
            done();
          });
      });
    });
  });

  describe('uniqueness', function() {
    it('should validate uniqueness', function(done) {
      User.validatesUniquenessOf('email');
      const u = new User({email: 'hey'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function() {
          const u2 = new User({email: 'hey'});
          u2.isValid(function(valid) {
            valid.should.be.false();
            done();
          });
        });
      })).should.be.false();
    });

    it('should handle same object modification', function(done) {
      User.validatesUniquenessOf('email');
      const u = new User({email: 'hey'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function() {
          u.name = 'Goghi';
          u.isValid(function(valid) {
            valid.should.be.true();
            u.save(done);
          });
        });
        // async validations always falsy when called as sync
      })).should.not.be.ok;
    });

    it('should support multi-key constraint', function(done) {
      const EMAIL = 'user@xample.com';
      const SiteUser = db.define('SiteUser', {
        siteId: String,
        email: String,
      });
      SiteUser.validatesUniquenessOf('email', {scopedTo: ['siteId']});
      async.waterfall([
        function automigrate(next) {
          db.automigrate(next);
        },
        function createSite1User(next) {
          SiteUser.create(
            {siteId: 1, email: EMAIL},
            next
          );
        },
        function createSite2User(user1, next) {
          SiteUser.create(
            {siteId: 2, email: EMAIL},
            next
          );
        },
        function validateDuplicateUser(user2, next) {
          const user3 = new SiteUser({siteId: 1, email: EMAIL});
          user3.isValid(function(valid) {
            valid.should.be.false();
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
      const u = new User({email: '  '});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function() {
          const u2 = new User({email: null});
          u2.isValid(function(valid) {
            valid.should.be.true();
            done();
          });
        });
      })).should.be.false();
    });

    it('should work with if/unless', function(done) {
      User.validatesUniquenessOf('email', {
        if: function() { return true; },
        unless: function() { return false; },
      });
      const u = new User({email: 'hello'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        done();
      })).should.be.false();
    });

    it('should work with id property on create', function(done) {
      Entry.create({id: 'entry'}, function(err, entry) {
        const e = new Entry({id: 'entry'});
        Boolean(e.isValid(function(valid) {
          valid.should.be.false();
          done();
        })).should.be.false();
      });
    });

    it('should work with id property after create', function(done) {
      Entry.findById('entry', function(err, e) {
        Boolean(e.isValid(function(valid) {
          valid.should.be.true();
          done();
        })).should.be.false();
      });
    });

    it('passes case insensitive validation', function(done) {
      User.validatesUniquenessOf('email', {ignoreCase: true});
      const u = new User({email: 'hey'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function(err) {
          if (err) return done(err);
          const u2 = new User({email: 'HEY'});
          u2.isValid(function(valid) {
            valid.should.be.false();
            done();
          });
        });
      })).should.be.false();
    });

    it('passed case sensitive validation', function(done) {
      User.validatesUniquenessOf('email', {ignoreCase: false});
      const u = new User({email: 'hey'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function(err) {
          if (err) return done(err);
          const u2 = new User({email: 'HEY'});
          u2.isValid(function(valid) {
            valid.should.be.true();
            done();
          });
        });
      })).should.be.false();
    });

    it('passes case insensitive validation with string that needs escaping', function(done) {
      User.validatesUniquenessOf('email', {ignoreCase: true});
      const u = new User({email: 'me+me@my.com'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function(err) {
          if (err) return done(err);
          const u2 = new User({email: 'ME+ME@MY.COM'});
          u2.isValid(function(valid) {
            valid.should.be.false();
            done();
          });
        });
      })).should.be.false();
    });

    it('passed case sensitive validation with string that needs escaping', function(done) {
      User.validatesUniquenessOf('email', {ignoreCase: false});
      const u = new User({email: 'me+me@my.com'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function(err) {
          if (err) return done(err);
          const u2 = new User({email: 'ME+ME@MY.COM'});
          u2.isValid(function(valid) {
            valid.should.be.true();
            done();
          });
        });
      })).should.be.false();
    });

    it('passes partial case insensitive validation with string that needs escaping', function(done) {
      User.validatesUniquenessOf('email', {ignoreCase: true});
      const u = new User({email: 'also+me@my.com'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function(err) {
          if (err) return done(err);
          const u2 = new User({email: 'Me@My.com'});
          u2.isValid(function(valid) {
            valid.should.be.true();
            done();
          });
        });
      })).should.be.false();
    });

    it('passes partial case sensitive validation with string that needs escaping', function(done) {
      User.validatesUniquenessOf('email', {ignoreCase: false});
      const u = new User({email: 'also+me@my.com'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        u.save(function(err) {
          if (err) return done(err);
          const u2 = new User({email: 'Me@My.com'});
          u2.isValid(function(valid) {
            valid.should.be.true();
            done();
          });
        });
      })).should.be.false();
    });

    describe('validate uniqueness on update', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesUniquenessOf('name');
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met', function(done) {
        const data = {name: 'Foo-new', age: 5};
        Employee.updateAll({id: 1}, data,
          function(err, emp) {
            should.not.exist(err);
            should.exist(emp);
            should.equal(emp.count, 1);
            Employee.find({where: {id: 1}}, function(err, emp) {
              should.not.exist(err);
              should.exist(emp);
              data.id = 1;
              should.deepEqual(data, emp[0].toObject());
              done();
            });
          });
      });

      it('throws err when validate condition is not met', function(done) {
        Employee.updateAll({where: {id: 1}}, {name: 'Bar', age: 5},
          function(err, emp) {
            should.exist(err);
            should.not.exist(emp);
            should.equal(err.statusCode, 422);
            should.equal(err.details.messages.name[0], 'is not unique');
            done();
          });
      });
    });
  });

  describe('format', function() {
    it('should validate the format of valid strings', function() {
      User.validatesFormatOf('name', {with: /[a-z][A-Z]*$/});
      const u = new User({name: 'valid name'});
      u.isValid().should.be.true();
    });

    it('should validate the format of invalid strings', function() {
      User.validatesFormatOf('name', {with: /[a-z][A-Z]*$/});
      const u = new User({name: 'invalid name!'});
      u.isValid().should.be.false();
    });

    it('should validate the format of valid numbers', function() {
      User.validatesFormatOf('age', {with: /^\d+$/});
      const u = new User({age: 30});
      u.isValid().should.be.true();
    });

    it('should validate the format of invalid numbers', function() {
      User.validatesFormatOf('age', {with: /^\d+$/});
      const u = new User({age: 'thirty'});
      u.isValid().should.be.false();
    });

    it('should overwrite default blank message with custom format message', function() {
      const CUSTOM_MESSAGE = 'custom validation message';
      User.validatesFormatOf('name', {with: /[a-z][A-Z]*$/, message: CUSTOM_MESSAGE});
      const u = new User({name: 'invalid name string 123'});
      u.isValid().should.be.false();
      u.errors.should.containEql({
        name: [CUSTOM_MESSAGE],
        codes: {
          name: ['format'],
        },
      });
    });

    it('should skip missing values when allowing blank', function() {
      User.validatesFormatOf('email', {with: /^\S+@\S+\.\S+$/, allowBlank: true});
      const u = new User({});
      u.isValid().should.be.true();
    });

    it('should skip null values when allowing null', function() {
      User.validatesFormatOf('email', {with: /^\S+@\S+\.\S+$/, allowNull: true});
      const u = new User({email: null});
      u.isValid().should.be.true();
    });

    it('should not skip missing values', function() {
      User.validatesFormatOf('email', {with: /^\S+@\S+\.\S+$/});
      const u = new User({});
      u.isValid().should.be.false();
    });

    it('should not skip null values', function() {
      User.validatesFormatOf('email', {with: /^\S+@\S+\.\S+$/});
      const u = new User({email: null});
      u.isValid().should.be.false();
    });

    describe('validate format correctly on bulk creation with global flag enabled in RegExp', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesFormatOf('name', {with: /^[a-z]+$/g, allowNull: false});
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met for all items', function(done) {
        Employee.create([
          {name: 'test'},
          {name: 'test'},
          {name: 'test'},
          {name: 'test'},
          {name: 'test'},
          {name: 'test'},
        ], (err, instances) => {
          should.not.exist(err);
          should.exist(instances);
          instances.should.have.lengthOf(6);
          done();
        });
      });
    });

    describe('validate format on update', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesFormatOf('name', {with: /^\w+\s\w+$/, allowNull: false});
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met', function(done) {
        const data = {name: 'Foo Mo', age: 5};
        Employee.updateAll({id: 1}, data,
          function(err, emp) {
            should.not.exist(err);
            should.exist(emp);
            should.equal(emp.count, 1);
            Employee.find({where: {id: 1}}, function(err, emp) {
              should.not.exist(err);
              should.exist(emp);
              data.id = 1;
              should.deepEqual(data, emp[0].toObject());
              done();
            });
          });
      });

      it('throws err when validate condition is not met', function(done) {
        Employee.updateAll({where: {id: 1}}, {name: '45foo', age: 5},
          function(err, emp) {
            should.exist(err);
            should.not.exist(emp);
            should.equal(err.statusCode, 422);
            should.equal(err.details.messages.name[0], 'is invalid');
            done();
          });
      });
    });
  });

  describe('numericality', function() {
    it('passes when given numeric values', function() {
      User.validatesNumericalityOf('age');
      const user = new User({age: 10});
      user.isValid().should.be.true();
    });

    it('fails when given non-numeric values', function() {
      User.validatesNumericalityOf('age');
      const user = new User({age: 'notanumber'});
      user.isValid().should.be.false();
      user.errors.should.containEql({age: ['is not a number']});
    });

    it('fails when given undefined values', function() {
      User.validatesNumericalityOf('age');
      const user = new User({});
      user.isValid().should.be.false();
      user.errors.should.containEql({age: ['is blank']});
    });

    it('skips undefined values when allowBlank option is true', function() {
      User.validatesNumericalityOf('age', {allowBlank: true});
      const user = new User({});
      user.isValid().should.be.true();
    });

    it('fails when given non-numeric values when allowBlank option is true', function() {
      User.validatesNumericalityOf('age', {allowBlank: true});
      const user = new User({age: 'test'});
      user.isValid().should.be.false();
      user.errors.should.containEql({age: ['is not a number']});
    });

    it('fails when given null values', function() {
      User.validatesNumericalityOf('age');
      const user = new User({age: null});
      user.isValid().should.be.false();
      user.errors.should.containEql({age: ['is null']});
    });

    it('passes when given null values when allowNull option is true', function() {
      User.validatesNumericalityOf('age', {allowNull: true});
      const user = new User({age: null});
      user.isValid().should.be.true();
    });

    it('passes when given float values', function() {
      User.validatesNumericalityOf('age');
      const user = new User({age: 13.37});
      user.isValid().should.be.true();
    });

    it('fails when given non-integer values when int option is true', function() {
      User.validatesNumericalityOf('age', {int: true});
      const user = new User({age: 13.37});
      user.isValid().should.be.false();
      user.errors.should.match({age: /is not an integer/});
    });

    describe('validate numericality on update', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesNumericalityOf('age');
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met', function(done) {
        const data = {name: 'Foo-new', age: 5};
        Employee.updateAll({id: 1}, data,
          function(err, emp) {
            should.not.exist(err);
            should.exist(emp);
            should.equal(emp.count, 1);
            Employee.find({where: {id: 1}}, function(err, emp) {
              should.not.exist(err);
              should.exist(emp);
              data.id = 1;
              should.deepEqual(data, emp[0].toObject());
              done();
            });
          });
      });

      it('throws err when validate condition is not met', function(done) {
        Employee.updateAll({where: {id: 1}}, {age: {someAge: 5}},
          function(err, emp) {
            should.exist(err);
            should.not.exist(emp);
            should.equal(err.statusCode, 422);
            should.equal(err.details.messages.age[0], 'is not a number');
            done();
          });
      });
    });
  });

  describe('inclusion', function() {
    it('fails when included value is not used for property', function(done) {
      User.validatesInclusionOf('name', {in: ['bob', 'john']});
      User.create({name: 'bobby'}, function(err) {
        err.should.be.instanceof(Error);
        err.details.messages.should.match({name: /is not included in the list/});
        done();
      });
    });

    it('passes when included value is used for property', function(done) {
      User.validatesInclusionOf('name', {in: ['bob', 'john']});
      User.create({name: 'bob'}, function(err, user) {
        if (err) return done(err);
        user.name.should.eql('bob');
        done();
      });
    });

    it('fails with a custom error message', function(done) {
      User.validatesInclusionOf('name', {in: ['bob', 'john'], message: 'not used'});
      User.create({name: 'dude'}, function(err) {
        err.should.be.instanceof(Error);
        err.details.messages.should.match({name: /not used/});
        done();
      });
    });

    it('fails with a null value when allowNull is false', function(done) {
      User.validatesInclusionOf('name', {in: ['bob'], allowNull: false});
      User.create({name: null}, function(err) {
        err.should.be.instanceof(Error);
        err.details.messages.should.match({name: /is null/});
        done();
      });
    });

    it('passes with a null value when allowNull is true', function(done) {
      User.validatesInclusionOf('name', {in: ['bob'], allowNull: true});
      User.create({name: null}, done);
    });

    it('fails if value is used for integer property', function(done) {
      User.validatesInclusionOf('age', {in: [123, 456]});
      User.create({age: 789}, function(err) {
        err.should.be.instanceof(Error);
        err.details.messages.should.match({age: /is not included in the list/});
        done();
      });
    });

    it('passes with an empty value when allowBlank option is true', function(done) {
      User.validatesInclusionOf('gender', {in: ['male', 'female'], allowBlank: true});
      User.create({gender: ''}, done);
    });

    it('fails with an empty value when allowBlank option is false', function(done) {
      User.validatesInclusionOf('gender', {in: ['male', 'female'], allowBlank: false});
      User.create({gender: ''}, function(err) {
        err.should.be.instanceOf(ValidationError);
        getErrorDetails(err)
          .should.equal('`gender` is blank (value: "").');
        done();
      });
    });

    function getErrorDetails(err) {
      return err.message.replace(/^.*Details: /, '');
    }

    describe('validate inclusion on update', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesInclusionOf('name', {in: ['Foo-new']});
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met', function(done) {
        const data = {name: 'Foo-new', age: 5};
        Employee.updateAll({id: 1}, data,
          function(err, emp) {
            should.not.exist(err);
            should.exist(emp);
            should.equal(emp.count, 1);
            Employee.find({where: {id: 1}}, function(err, emp) {
              should.not.exist(err);
              should.exist(emp);
              data.id = 1;
              should.deepEqual(data, emp[0].toObject());
              done();
            });
          });
      });

      it('throws err when validate condition is not met', function(done) {
        Employee.updateAll({where: {id: 1}}, {name: 'Foo-new2', age: 5},
          function(err, emp) {
            should.exist(err);
            should.not.exist(emp);
            should.equal(err.statusCode, 422);
            should.equal(err.details.messages.name[0], 'is not included in ' +
            'the list');
            done();
          });
      });
    });
  });

  describe('exclusion', function() {
    it('fails when excluded value is used for property', function(done) {
      User.validatesExclusionOf('name', {in: ['bob']});
      User.create({name: 'bob'}, function(err, user) {
        err.should.be.instanceof(Error);
        err.details.messages.should.match({name: /is reserved/});
        done();
      });
    });

    it('passes when excluded value not found for property', function(done) {
      User.validatesExclusionOf('name', {in: ['dude']});
      User.create({name: 'bob'}, function(err, user) {
        if (err) return done(err);
        user.name.should.eql('bob');
        done();
      });
    });

    it('fails with a custom error message', function(done) {
      User.validatesExclusionOf('name', {in: ['bob'], message: 'cannot use this'});
      User.create({name: 'bob'}, function(err) {
        err.should.be.instanceof(Error);
        err.details.messages.should.match({name: /cannot use this/});
        done();
      });
    });

    it('fails with a null value when allowNull is false', function(done) {
      User.validatesExclusionOf('name', {in: ['bob'], allowNull: false});
      User.create({name: null}, function(err) {
        err.should.be.instanceof(Error);
        err.details.messages.should.match({name: /is null/});
        done();
      });
    });

    it('passes with a null value when allowNull is true', function(done) {
      User.validatesExclusionOf('name', {in: ['bob'], allowNull: true});
      User.create({name: null}, done);
    });

    it('fails if value is used for integer property', function(done) {
      User.validatesExclusionOf('age', {in: [123, 456]});
      User.create({age: 123}, function(err) {
        err.should.be.instanceof(Error);
        err.details.messages.should.match({age: /is reserved/});
        done();
      });
    });

    describe('validate exclusion on update', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesExclusionOf('name', {in: ['Bob']});
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met', function(done) {
        const data = {name: 'Foo-new', age: 5};
        Employee.updateAll({id: 1}, data,
          function(err, emp) {
            should.not.exist(err);
            should.exist(emp);
            should.equal(emp.count, 1);
            Employee.find({where: {id: 1}}, function(err, emp) {
              should.not.exist(err);
              should.exist(emp);
              data.id = 1;
              should.deepEqual(data, emp[0].toObject());
              done();
            });
          });
      });

      it('throws err when validate condition is not met', function(done) {
        Employee.updateAll({where: {id: 1}}, {name: 'Bob', age: 5},
          function(err, emp) {
            should.exist(err);
            should.not.exist(emp);
            should.equal(err.statusCode, 422);
            should.equal(err.details.messages.name[0], 'is reserved');
            done();
          });
      });
    });
  });

  describe('length', function() {
    it('should validate length');

    describe('validate length on update', function() {
      before(function(done) {
        Employee.destroyAll(function(err) {
          should.not.exist(err);
          delete Employee.validations;
          db.automigrate('Employee', function(err) {
            should.not.exist(err);
            Employee.create(empData, function(err, inst) {
              should.not.exist(err);
              should.exist(inst);
              Employee.validatesLengthOf('name', {min: 5});
              done();
            });
          });
        });
      });

      it('succeeds when validate condition is met', function(done) {
        const data = {name: 'Foo-new', age: 5};
        Employee.updateAll({id: 1}, data,
          function(err, emp) {
            should.not.exist(err);
            should.exist(emp);
            should.equal(emp.count, 1);
            Employee.find({where: {id: 1}}, function(err, emp) {
              should.not.exist(err);
              should.exist(emp);
              data.id = 1;
              should.deepEqual(data, emp[0].toObject());
              done();
            });
          });
      });

      it('throws err when validate condition is not met', function(done) {
        Employee.updateAll({where: {id: 1}}, {name: 'Bob', age: 5},
          function(err, emp) {
            should.exist(err);
            should.not.exist(emp);
            should.equal(err.statusCode, 422);
            should.equal(err.details.messages.name[0], 'too short');
            done();
          });
      });
    });
  });

  describe('custom', function() {
    it('should validate using custom sync validation', function() {
      User.validate('email', function(err) {
        if (this.email === 'hello') err();
      }, {code: 'invalid-email'});
      const u = new User({email: 'hello'});
      Boolean(u.isValid()).should.be.false();
      u.errors.codes.should.eql({email: ['invalid-email']});
    });

    it('should validate and return detailed error messages', function() {
      User.validate('global', function(err) {
        if (this.email === 'hello' || this.email === 'hey') {
          this.errors.add('email', 'Cannot be `' + this.email + '`', 'invalid-email');
          err(false); // false: prevent global error message
        }
      });
      const u = new User({email: 'hello'});
      Boolean(u.isValid()).should.be.false();
      u.errors.should.containEql({email: ['Cannot be `hello`']});
      u.errors.codes.should.eql({email: ['invalid-email']});
    });

    it('should validate using custom async validation', function(done) {
      User.validateAsync('email', function(err, next) {
        process.nextTick(next);
      }, {
        if: function() { return true; },
        unless: function() { return false; },
      });
      const u = new User({email: 'hello'});
      Boolean(u.isValid(function(valid) {
        valid.should.be.true();
        done();
      })).should.be.false();
    });
  });

  describe('invalid value formatting', function() {
    let origMaxLen;
    beforeEach(function saveAndSetMaxLen() {
      origMaxLen = ValidationError.maxPropertyStringLength;
    });

    afterEach(function restoreMaxLen() {
      ValidationError.maxPropertyStringLength = origMaxLen;
    });

    it('should truncate long strings', function() {
      ValidationError.maxPropertyStringLength = 9;
      const err = givenValidationError('prop', '1234567890abc', 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: "12...abc").');
    });

    it('should truncate long objects', function() {
      ValidationError.maxPropertyStringLength = 12;
      const err = givenValidationError('prop', {foo: 'bar'}, 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: { foo:... }).');
    });

    it('should truncate long arrays', function() {
      ValidationError.maxPropertyStringLength = 12;
      const err = givenValidationError('prop', [{a: 1, b: 2}], 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: [ { a...} ]).');
    });

    it('should print only top-level object properties', function() {
      const err = givenValidationError('prop', {a: {b: 'c'}}, 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: { a: [Object] }).');
    });

    it('should print only top-level props of objects in array', function() {
      const err = givenValidationError('prop', [{a: {b: 'c'}}], 'is invalid');
      getErrorDetails(err)
        .should.equal('`prop` is invalid (value: [ { a: [Object] } ]).');
    });

    it('should exclude colors from Model values', function() {
      const obj = new User();
      obj.email = 'test@example.com';
      const err = givenValidationError('user', obj, 'is invalid');
      getErrorDetails(err).should.equal(
        '`user` is invalid (value: { email: \'test@example.com\' }).'
      );
    });

    function givenValidationError(propertyName, propertyValue, errorMessage) {
      const jsonVal = {};
      jsonVal[propertyName] = propertyValue;
      const errorVal = {};
      errorVal[propertyName] = [errorMessage];

      const obj = {
        errors: errorVal,
        toJSON: function() { return jsonVal; },
      };
      return new ValidationError(obj);
    }

    function getErrorDetails(err) {
      return err.message.replace(/^.*Details: /, '');
    }
  });

  describe('date', function() {
    it('should validate a date object', function() {
      User.validatesDateOf('updatedAt');
      const u = new User({updatedAt: new Date()});
      u.isValid().should.be.true();
    });

    it('should validate a date string', function() {
      User.validatesDateOf('updatedAt');
      const u = new User({updatedAt: '2000-01-01'});
      u.isValid().should.be.true();
    });

    it('should validate a null date', function() {
      User.validatesDateOf('updatedAt');
      const u = new User({updatedAt: null});
      u.isValid().should.be.true();
    });

    it('should validate an undefined date', function() {
      User.validatesDateOf('updatedAt');
      const u = new User({updatedAt: undefined});
      u.isValid().should.be.true();
    });

    it('should validate an invalid date string', function() {
      User.validatesDateOf('updatedAt');
      const u = new User({updatedAt: 'invalid date string'});
      u.isValid().should.not.be.true();
      u.errors.should.containEql({
        updatedAt: ['is not a valid date'],
        codes: {
          updatedAt: ['date'],
        },
      });
    });

    it('should attach validation by default to all date properties', function() {
      const AnotherUser = db.define('User', {
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
      const u = new AnotherUser({updatedAt: 'invalid date string'});
      u.isValid().should.not.be.true();
      u.errors.should.containEql({
        updatedAt: ['is not a valid date'],
        codes: {
          updatedAt: ['date'],
        },
      });
    });

    it('should overwrite default blank message with custom format message', function() {
      const CUSTOM_MESSAGE = 'custom validation message';
      User.validatesDateOf('updatedAt', {message: CUSTOM_MESSAGE});
      const u = new User({updatedAt: 'invalid date string'});
      u.isValid().should.not.be.true();
      u.errors.should.containEql({
        updatedAt: [CUSTOM_MESSAGE],
        codes: {
          updatedAt: ['date'],
        },
      });
    });
  });
});

const empData = [{
  id: 1,
  name: 'Foo',
  age: 1,
}, {
  id: 2,
  name: 'Bar',
  age: 2,
}, {
  id: 3,
  name: 'Baz',
  age: 3,
}];
