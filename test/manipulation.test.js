// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false, connectorCapabilities:false */
var async = require('async');
var bdd = require('./helpers/bdd-if');
var should = require('./init.js');
var uid = require('./helpers/uid-generator');

var db, Person;
var ValidationError = require('..').ValidationError;

var UUID_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('manipulation', function() {
  before(function(done) {
    db = getSchema();

    Person = db.define('Person', {
      name: String,
      gender: String,
      married: Boolean,
      age: {type: Number, index: true},
      dob: Date,
      createdAt: {type: Date, default: Date},
    }, {forceId: true, strict: true});

    db.automigrate(['Person'], done);
  });

  // A simplified implementation of LoopBack's User model
  // to reproduce problems related to properties with dynamic setters
  // For the purpose of the tests, we use a counter instead of a hash fn.
  var StubUser;
  var stubPasswordCounter;

  before(function setupStubUserModel(done) {
    StubUser = db.createModel('StubUser', {password: String}, {forceId: true});
    StubUser.setter.password = function(plain) {
      var hashed = false;
      if (!plain) return;
      var pos = plain.indexOf('-');
      if (pos !== -1) {
        var head = plain.substr(0, pos);
        var tail = plain.substr(pos + 1, plain.length);
        hashed = head.toUpperCase() === tail;
      }
      if (hashed) return;
      this.$password = plain + '-' + plain.toUpperCase();
    };
    db.automigrate('StubUser', done);
  });

  beforeEach(function resetStubPasswordCounter() {
    stubPasswordCounter = 0;
  });

  describe('create', function() {
    before(function(done) {
      Person.destroyAll(done);
    });

    describe('forceId', function() {
      var TestForceId;
      before(function(done) {
        TestForceId = db.define('TestForceId');
        db.automigrate('TestForceId', done);
      });

      it('it defaults to forceId:true for generated id property', function(done) {
        TestForceId.create({id: 1}, function(err, t) {
          should.exist(err);
          err.message.should.match(/can\'t be set/);
          done();
        });
      });
    });

    it('should create instance', function(done) {
      Person.create({name: 'Anatoliy'}, function(err, p) {
        if (err) return done(err);
        should.exist(p);
        p.name.should.equal('Anatoliy');
        Person.findById(p.id, function(err, person) {
          if (err) return done(err);
          person.id.should.eql(p.id);
          person.name.should.equal('Anatoliy');
          done();
        });
      });
    });

    it('should create instance (promise variant)', function(done) {
      Person.create({name: 'Anatoliy'})
        .then(function(p) {
          p.name.should.equal('Anatoliy');
          should.exist(p);
          return Person.findById(p.id)
            .then(function(person) {
              person.id.should.eql(p.id);
              person.name.should.equal('Anatoliy');
              done();
            });
        })
        .catch(done);
    });

    it('should instantiate an object', function(done) {
      var p = new Person({name: 'Anatoliy'});
      p.name.should.equal('Anatoliy');
      p.isNewRecord().should.be.true;
      p.save(function(err, inst) {
        if (err) return done(err);
        inst.isNewRecord().should.be.false;
        inst.should.equal(p);
        done();
      });
    });

    it('should instantiate an object (promise variant)', function(done) {
      var p = new Person({name: 'Anatoliy'});
      p.name.should.equal('Anatoliy');
      p.isNewRecord().should.be.true;
      p.save()
        .then(function(inst) {
          inst.isNewRecord().should.be.false;
          inst.should.equal(p);
          done();
        })
        .catch(done);
    });

    it('should not return instance of object', function(done) {
      var person = Person.create(function(err, p) {
        if (err) return done(err);
        should.exist(p.id);
        if (person) person.should.not.be.an.instanceOf(Person);
        done();
      });
    });

    it('should not allow user-defined value for the id of object - create', function(done) {
      Person.create({id: 123456}, function(err, p) {
        err.should.be.instanceof(ValidationError);
        err.statusCode.should.equal(422);
        err.details.messages.id.should.eql(['can\'t be set']);
        p.should.be.instanceof(Person);
        p.isNewRecord().should.be.true;
        done();
      });
    });

    it('should not allow user-defined value for the id of object - create (promise variant)', function(done) {
      Person.create({id: 123456})
        .then(function(p) {
          done(new Error('Person.create should have failed.'));
        }, function(err) {
          err.should.be.instanceof(ValidationError);
          err.statusCode.should.equal(422);
          err.details.messages.id.should.eql(['can\'t be set']);
          done();
        })
        .catch(done);
    });

    it('should not allow user-defined value for the id of object - save', function(done) {
      var p = new Person({id: 123456});
      p.isNewRecord().should.be.true;
      p.save(function(err, inst) {
        err.should.be.instanceof(ValidationError);
        err.statusCode.should.equal(422);
        err.details.messages.id.should.eql(['can\'t be set']);
        inst.isNewRecord().should.be.true;
        done();
      });
    });

    it('should not allow user-defined value for the id of object - save (promise variant)', function(done) {
      var p = new Person({id: 123456});
      p.isNewRecord().should.be.true;
      p.save()
        .then(function(inst) {
          done(new Error('save should have failed.'));
        }, function(err) {
          err.should.be.instanceof(ValidationError);
          err.statusCode.should.equal(422);
          err.details.messages.id.should.eql(['can\'t be set']);
          done();
        })
        .catch(done);
    });

    it('should work when called without callback', function(done) {
      Person.afterCreate = function(next) {
        this.should.be.an.instanceOf(Person);
        this.name.should.equal('Nickolay');
        should.exist(this.id);
        Person.afterCreate = null;
        next();
        setTimeout(done, 10);
      };
      Person.create({name: 'Nickolay'});
    });

    it('should create instance with blank data', function(done) {
      Person.create(function(err, p) {
        if (err) return done(err);
        should.exist(p);
        should.not.exists(p.name);
        Person.findById(p.id, function(err, person) {
          if (err) return done(err);
          person.id.should.eql(p.id);
          should.not.exists(person.name);
          done();
        });
      });
    });

    it('should create instance with blank data (promise variant)', function(done) {
      Person.create()
        .then(function(p) {
          should.exist(p);
          should.not.exists(p.name);
          return Person.findById(p.id)
          .then(function(person) {
            person.id.should.eql(p.id);
            should.not.exists(person.name);
            done();
          });
        }).catch(done);
    });

    it('should work when called with no data and callback', function(done) {
      Person.afterCreate = function(next) {
        this.should.be.an.instanceOf(Person);
        should.not.exist(this.name);
        should.exist(this.id);
        Person.afterCreate = null;
        next();
        setTimeout(done, 30);
      };
      Person.create();
    });

    it('should create batch of objects', function(done) {
      var batch = [
        {name: 'Shaltay'},
        {name: 'Boltay'},
        {},
      ];
      var res = Person.create(batch, function(e, ps) {
        if (res) res.should.not.be.instanceOf(Array);
        should.not.exist(e);
        should.exist(ps);
        ps.should.be.instanceOf(Array);
        ps.should.have.lengthOf(batch.length);

        Person.validatesPresenceOf('name');
        Person.create(batch, function(errors, persons) {
          delete Person.validations;
          should.exist(errors);
          errors.should.have.lengthOf(batch.length);
          should.not.exist(errors[0]);
          should.not.exist(errors[1]);
          should.exist(errors[2]);

          should.exist(persons);
          persons.should.have.lengthOf(batch.length);
          persons[0].errors.should.be.false;
          done();
        });
      });
    });

    it('should create batch of objects (promise variant)', function(done) {
      var batch = [
        {name: 'ShaltayPromise'},
        {name: 'BoltayPromise'},
        {},
      ];
      Person.create(batch).then(function(ps) {
        should.exist(ps);
        ps.should.be.instanceOf(Array);
        ps.should.have.lengthOf(batch.length);

        Person.validatesPresenceOf('name');
        Person.create(batch, function(errors, persons) {
          delete Person.validations;
          should.exist(errors);
          errors.should.have.lengthOf(batch.length);
          should.not.exist(errors[0]);
          should.not.exist(errors[1]);
          should.exist(errors[2]);

          should.exist(persons);
          persons.should.have.lengthOf(batch.length);
          persons[0].errors.should.be.false;
          done();
        });
      });
    });

    it('should create batch of objects with beforeCreate', function(done) {
      Person.beforeCreate = function(next, data) {
        if (data && data.name === 'A') {
          return next(null, {id: 'a', name: 'A'});
        } else {
          return next();
        }
      };
      var batch = [
        {name: 'A'},
        {name: 'B'},
        undefined,
      ];
      Person.create(batch, function(e, ps) {
        should.not.exist(e);
        should.exist(ps);
        ps.should.be.instanceOf(Array);
        ps.should.have.lengthOf(batch.length);
        ps[0].should.be.eql({id: 'a', name: 'A'});
        done();
      });
    });

    it('should preserve properties with "undefined" value', function(done) {
      Person.create(
        {name: 'a-name', gender: undefined},
        function(err, created) {
          if (err) return done(err);
          created.toObject().should.have.properties({
            id: created.id,
            name: 'a-name',
            gender: undefined,
          });

          Person.findById(created.id, function(err, found) {
            if (err) return done(err);
            var result = found.toObject();
            result.should.containEql({
              id: created.id,
              name: 'a-name',
            });
            // The gender can be null from a RDB
            should.equal(result.gender, null);
            done();
          });
        });
    });

    bdd.itIf(connectorCapabilities.refuseDuplicateInsert !== false, 'should refuse to create ' +
    'object with duplicate id', function(done) {
      // NOTE(bajtos) We cannot reuse Person model here,
      // `settings.forceId` aborts the CREATE request at the validation step.
      var Product = db.define('ProductTest', {name: String}, {forceId: false});
      db.automigrate('ProductTest', function(err) {
        if (err) return done(err);

        Product.create({name: 'a-name'}, function(err, p) {
          if (err) return done(err);
          Product.create({id: p.id, name: 'duplicate'}, function(err, result) {
            if (!err) {
              return done(new Error('Create should have rejected duplicate id.'));
            }
            err.message.should.match(/duplicate/i);
            done();
          });
        });
      });
    });
  });

  describe('save', function() {
    it('should save new object', function(done) {
      var p = new Person;
      should.not.exist(p.id);
      p.save(function(err) {
        if (err) return done(err);
        should.exist(p.id);
        done();
      });
    });

    it('should save new object (promise variant)', function(done) {
      var p = new Person;
      should.not.exist(p.id);
      p.save()
        .then(function() {
          should.exist(p.id);
          done();
        })
        .catch(done);
    });

    it('should save existing object', function(done) {
      Person.findOne(function(err, p) {
        if (err) return done(err);
        p.name = 'Hans';
        p.save(function(err) {
          if (err) return done(err);
          p.name.should.equal('Hans');
          Person.findOne(function(err, p) {
            if (err) return done(err);
            p.name.should.equal('Hans');
            done();
          });
        });
      });
    });

    it('should save existing object (promise variant)', function(done) {
      Person.findOne()
        .then(function(p) {
          p.name = 'Fritz';
          return p.save()
            .then(function() {
              return Person.findOne()
                .then(function(p) {
                  p.name.should.equal('Fritz');
                  done();
                });
            });
        })
        .catch(done);
    });

    it('should save invalid object (skipping validation)', function(done) {
      Person.findOne(function(err, p) {
        if (err) return done(err);
        p.isValid = function(done) {
          process.nextTick(done);
          return false;
        };
        p.name = 'Nana';
        p.save(function(err) {
          should.exist(err);
          p.save({validate: false}, function(err) {
            if (err) return done(err);
            done();
          });
        });
      });
    });

    it('should save invalid object (skipping validation - promise variant)', function(done) {
      Person.findOne()
        .then(function(p) {
          p.isValid = function(done) {
            process.nextTick(done);
            return false;
          };
          p.name = 'Nana';
          return p.save()
            .then(function(d) {
              done(new Error('save should have failed.'));
            }, function(err) {
              should.exist(err);
              p.save({validate: false})
                .then(function(d) {
                  should.exist(d);
                  done();
                });
            });
        })
        .catch(done);
    });

    it('should save throw error on validation', function(done) {
      Person.findOne(function(err, p) {
        if (err) return done(err);
        p.isValid = function(cb) {
          cb(false);
          return false;
        };
        (function() {
          p.save({
            'throws': true,
          });
        }).should.throw(ValidationError);
        done();
      });
    });

    it('should preserve properties with dynamic setters', function(done) {
      // This test reproduces a problem discovered by LoopBack unit-test
      // "User.hasPassword() should match a password after it is changed"
      StubUser.create({password: 'foo'}, function(err, created) {
        if (err) return done(err);
        created.password.should.equal('foo-FOO');
        created.password = 'bar';
        created.save(function(err, saved) {
          if (err) return done(err);
          created.id.should.eql(saved.id);
          saved.password.should.equal('bar-BAR');
          StubUser.findById(created.id, function(err, found) {
            if (err) return done(err);
            created.id.should.eql(found.id);
            found.password.should.equal('bar-BAR');
            done();
          });
        });
      });
    });
  });

  describe('updateAttributes', function() {
    var person;

    before(function(done) {
      Person.destroyAll(function(err) {
        if (err) return done(err);
        Person.create({name: 'Mary', age: 15}, function(err, p) {
          if (err) return done(err);
          person = p;
          done();
        });
      });
    });

    it('should have updated password hashed with updateAttribute',
    function(done) {
      StubUser.create({password: 'foo'}, function(err, created) {
        if (err) return done(err);
        created.updateAttribute('password', 'test', function(err, created) {
          if (err) return done(err);
          created.password.should.equal('test-TEST');
          StubUser.findById(created.id, function(err, found) {
            if (err) return done(err);
            found.password.should.equal('test-TEST');
            done();
          });
        });
      });
    });

    it('should update one attribute', function(done) {
      person.updateAttribute('name', 'Paul Graham', function(err, p) {
        if (err) return done(err);
        Person.all(function(e, ps) {
          if (e) return done(e);
          ps.should.have.lengthOf(1);
          ps.pop().name.should.equal('Paul Graham');
          done();
        });
      });
    });

    it('should update one attribute (promise variant)', function(done) {
      person.updateAttribute('name', 'Teddy Graham')
      .then(function(p) {
        return Person.all()
        .then(function(ps) {
          ps.should.have.lengthOf(1);
          ps.pop().name.should.equal('Teddy Graham');
          done();
        });
      }).catch(done);
    });

    it('should ignore undefined values on updateAttributes', function(done) {
      person.updateAttributes({'name': 'John', age: undefined},
        function(err, p) {
          if (err) return done(err);
          Person.findById(p.id, function(e, p) {
            if (e) return done(e);
            p.name.should.equal('John');
            p.age.should.equal(15);
            done();
          });
        });
    });

    it('should discard undefined values before strict validation',
      function(done) {
        Person.definition.settings.strict = true;
        Person.findById(person.id, function(err, p) {
          if (err) return done(err);
          p.updateAttributes({name: 'John', unknownVar: undefined},
            function(err, p) {
              // if uknownVar was defined, it would return validationError
              if (err) return done(err);
              person.id.should.eql(p.id);
              Person.findById(p.id, function(e, p) {
                if (e) return done(e);
                p.name.should.equal('John');
                p.should.not.have.property('unknownVar');
                done();
              });
            });
        });
      });

    it('should allow unknown attributes when strict: false',
      function(done) {
        Person.definition.settings.strict = false;
        Person.findById(person.id, function(err, p) {
          if (err) return done(err);
          p.updateAttributes({name: 'John', foo: 'bar'},
            function(err, p) {
              if (err) return done(err);
              p.should.have.property('foo');
              done();
            });
        });
      });

    // Prior to version 3.0 `strict: true` used to silently remove unknown properties,
    // now return validationError upon unknown properties
    it('should return error on unknown attributes when strict: true',
      function(done) {
        // Using {foo: 'bar'} only causes dependent test failures due to the
        // stripping of object properties when in strict mode (ie. {foo: 'bar'}
        // changes to '{}' and breaks other tests
        Person.definition.settings.strict = true;
        Person.findById(person.id, function(err, p) {
          if (err) return done(err);
          p.updateAttributes({name: 'John', foo: 'bar'},
            function(err, p) {
              should.exist(err);
              err.name.should.equal('ValidationError');
              err.message.should.containEql('`foo` is not defined in the model');
              p.should.not.have.property('foo');
              Person.findById(p.id, function(e, p) {
                if (e) return done(e);
                p.should.not.have.property('foo');
                done();
              });
            });
        });
      });

    // strict: throw is deprecated, use strict: true instead
    // which returns Validation Error for unknown properties
    it('should fallback to strict:true when using strict: throw', function(done) {
      Person.definition.settings.strict = 'throw';
      Person.findById(person.id, function(err, p) {
        if (err) return done(err);
        p.updateAttributes({foo: 'bar'},
          function(err, p) {
            should.exist(err);
            err.name.should.equal('ValidationError');
            err.message.should.containEql('`foo` is not defined in the model');
            Person.findById(person.id, function(e, p) {
              if (e) return done(e);
              p.should.not.have.property('foo');
              done();
            });
          });
      });
    });

    // strict: validate is deprecated, use strict: true instead
    // behavior remains the same as before, because validate is now default behavior
    it('should fallback to strict:true when using strict:validate', function(done) {
      Person.definition.settings.strict = 'validate';
      Person.findById(person.id, function(err, p) {
        if (err) return done(err);
        p.updateAttributes({foo: 'bar'},
          function(err, p) {
            should.exist(err);
            err.name.should.equal('ValidationError');
            err.message.should.containEql('`foo` is not defined in the model');
            Person.findById(person.id, function(e, p) {
              if (e) return done(e);
              p.should.not.have.property('foo');
              done();
            });
          });
      });
    });

    it('should allow same id value on updateAttributes', function(done) {
      person.updateAttributes({id: person.id, name: 'John'},
        function(err, p) {
          if (err) return done(err);
          Person.findById(p.id, function(e, p) {
            if (e) return done(e);
            p.name.should.equal('John');
            p.age.should.equal(15);
            done();
          });
        });
    });

    it('should allow same stringified id value on updateAttributes',
      function(done) {
        var pid = person.id;
        if (typeof person.id === 'object' || typeof person.id === 'number') {
          // For example MongoDB ObjectId
          pid = person.id.toString();
        }
        person.updateAttributes({id: pid, name: 'John'},
          function(err, p) {
            if (err) return done(err);
            Person.findById(p.id, function(e, p) {
              if (e) return done(e);
              p.name.should.equal('John');
              p.age.should.equal(15);
              done();
            });
          });
      });

    it('should fail if an id value is to be changed on updateAttributes',
      function(done) {
        person.updateAttributes({id: person.id + 1, name: 'John'},
        function(err, p) {
          should.exist(err);
          done();
        });
      });

    it('has an alias "patchAttributes"', function(done) {
      person.updateAttributes.should.equal(person.patchAttributes);
      done();
    });

    it('should allow model instance on updateAttributes', function(done) {
      person.updateAttributes(new Person({'name': 'John', age: undefined}),
        function(err, p) {
          if (err) return done(err);
          Person.findById(p.id, function(e, p) {
            if (e) return done(e);
            p.name.should.equal('John');
            p.age.should.equal(15);
            done();
          });
        });
    });

    it('should allow model instance on updateAttributes (promise variant)', function(done) {
      person.updateAttributes(new Person({'name': 'Jane', age: undefined}))
        .then(function(p) {
          return Person.findById(p.id)
            .then(function(p) {
              p.name.should.equal('Jane');
              p.age.should.equal(15);
              done();
            });
        })
        .catch(done);
    });

    it('should raises on connector error', function(done) {
      var fakeConnector = {
        updateAttributes: function(model, id, data, options, cb) {
          cb(new Error('Database Error'));
        },
      };
      person.getConnector = function() { return fakeConnector; };
      person.updateAttributes({name: 'John'}, function(err, p) {
        should.exist(err);
        done();
      });
    });
  });

  describe('updateOrCreate', function() {
    var Post, Todo;

    before('prepare "Post" and "Todo" models', function(done) {
      Post = db.define('Post', {
        title: {type: String, id: true},
        content: {type: String},
      });
      Todo = db.define('Todo', {
        content: String,
      });
      // Here `Person` model overrides the one outside 'updataOrCreate'
      // with forceId: false. Related test cleanup see issue:
      // https://github.com/strongloop/loopback-datasource-juggler/issues/1317
      Person = db.define('Person', {
        name: String,
        gender: String,
        married: Boolean,
        age: {type: Number, index: true},
        dob: Date,
        createdAt: {type: Date, default: Date},
      }, {forceId: false});
      db.automigrate(['Post', 'Todo', 'Person'], done);
    });

    beforeEach(function deleteModelsInstances(done) {
      Todo.deleteAll(done);
    });

    it('has an alias "patchOrCreate"', function() {
      StubUser.updateOrCreate.should.equal(StubUser.patchOrCreate);
    });

    it('creates a model when one does not exist', function(done) {
      Todo.updateOrCreate({content: 'a'}, function(err, data) {
        if (err) return done(err);

        Todo.findById(data.id, function(err, todo) {
          should.exist(todo);
          should.exist(todo.content);
          todo.content.should.equal('a');

          done();
        });
      });
    });

    it('updates a model if it exists', function(done) {
      Todo.create({content: 'a'}, function(err, todo) {
        Todo.updateOrCreate({id: todo.id, content: 'b'}, function(err, data) {
          if (err) return done(err);

          should.exist(data);
          should.exist(data.id);
          data.id.should.eql(todo.id);
          should.exist(data.content);
          data.content.should.equal('b');

          done();
        });
      });
    });

    it('throws error for queries with array input', function(done) {
      Todo.updateOrCreate([{content: 'a'}], function(err, data) {
        should.exist(err);
        err.message.should.containEql('bulk');
        should.not.exist(data);

        done();
      });
    });

    it('should preserve properties with dynamic setters on create', function(done) {
      StubUser.updateOrCreate({password: 'foo'}, function(err, created) {
        if (err) return done(err);
        created.password.should.equal('foo-FOO');
        StubUser.findById(created.id, function(err, found) {
          if (err) return done(err);
          found.password.should.equal('foo-FOO');
          done();
        });
      });
    });

    it('should preserve properties with dynamic setters on update', function(done) {
      StubUser.create({password: 'foo'}, function(err, created) {
        if (err) return done(err);
        var data = {id: created.id, password: 'bar'};
        StubUser.updateOrCreate(data, function(err, updated) {
          if (err) return done(err);
          updated.password.should.equal('bar-BAR');
          StubUser.findById(created.id, function(err, found) {
            if (err) return done(err);
            found.password.should.equal('bar-BAR');
            done();
          });
        });
      });
    });

    it('should preserve properties with "undefined" value', function(done) {
      Person.create(
        {name: 'a-name', gender: undefined},
        function(err, instance) {
          if (err) return done(err);
          var result = instance.toObject();
          result.id.should.eql(instance.id);
          should.equal(result.name, 'a-name');
          should.equal(result.gender, undefined);

          Person.updateOrCreate(
            {id: instance.id, name: 'updated name'},
            function(err, updated) {
              if (err) return done(err);
              var result = updated.toObject();
              result.id.should.eql(instance.id);
              should.equal(result.name, 'updated name');
              should.equal(result.gender, null);

              done();
            });
        });
    });

    it('updates specific instances when PK is not an auto-generated id', function(done) {
      // skip the test if the connector is mssql
      // https://github.com/strongloop/loopback-connector-mssql/pull/92#r72853474
      var dsName = Post.dataSource.name;
      if (dsName === 'mssql') return done();

      Post.create([
        {title: 'postA', content: 'contentA'},
        {title: 'postB', content: 'contentB'},
      ], function(err, instance) {
        if (err) return done(err);

        Post.updateOrCreate({
          title: 'postA', content: 'newContent',
        }, function(err, instance) {
          if (err) return done(err);

          var result = instance.toObject();
          result.should.have.properties({
            title: 'postA',
            content: 'newContent',
          });
          Post.find(function(err, posts) {
            if (err) return done(err);

            posts.should.have.length(2);
            posts[0].title.should.equal('postA');
            posts[0].content.should.equal('newContent');
            posts[1].title.should.equal('postB');
            posts[1].content.should.equal('contentB');
            done();
          });
        });
      });
    });

    it('should allow save() of the created instance', function(done) {
      var unknownId = uid.fromConnector(db) || 999;
      Person.updateOrCreate(
        {id: unknownId, name: 'a-name'},
        function(err, inst) {
          if (err) return done(err);
          inst.save(done);
        });
    });
  });

  bdd.describeIf(connectorCapabilities.supportForceId !== false,
    'updateOrCreate when forceId is true', function() {
      var Post;
      before(function definePostModel(done) {
        var ds = getSchema();
        Post = ds.define('Post', {
          title: {type: String, length: 255},
          content: {type: String},
        }, {forceId: true});
        ds.automigrate('Post', done);
      });

      it('fails when id does not exist in db & validate is true', function(done) {
        var unknownId = uid.fromConnector(db) || 123;
        var post = {id: unknownId, title: 'a', content: 'AAA'};
        Post.updateOrCreate(post, {validate: true}, (err) => {
          should(err).have.property('statusCode', 404);
          done();
        });
      });

      it('fails when id does not exist in db & validate is false', function(done) {
        var unknownId = uid.fromConnector(db) || 123;
        var post = {id: unknownId, title: 'a', content: 'AAA'};
        Post.updateOrCreate(post, {validate: false}, (err) => {
          should(err).have.property('statusCode', 404);
          done();
        });
      });

      it('fails when id does not exist in db & validate is false when using updateAttributes',
      function(done) {
        var unknownId = uid.fromConnector(db) || 123;
        var post = new Post({id: unknownId});
        post.updateAttributes({title: 'updated title', content: 'AAA'}, {validate: false}, (err) => {
          should(err).have.property('statusCode', 404);
          done();
        });
      });

      it('works on create if the request does not include an id', function(done) {
        var post = {title: 'a', content: 'AAA'};
        Post.updateOrCreate(post, (err, p) => {
          if (err) return done(err);
          p.title.should.equal(post.title);
          p.content.should.equal(post.content);
          done();
        });
      });

      it('works on update if the request includes an existing id in db', function(done) {
        Post.create({title: 'a', content: 'AAA'}, (err, post) => {
          if (err) return done(err);
          post = post.toObject();
          delete post.content;
          post.title = 'b';
          Post.updateOrCreate(post, function(err, p) {
            if (err) return done(err);
            p.id.should.equal(post.id);
            p.title.should.equal('b');
            done();
          });
        });
      });
    });

  if (!getSchema().connector.replaceById) {
    describe.skip('replaceById - not implemented', function() {});
  } else {
    describe('replaceOrCreate', function() {
      var Post, unknownId;
      before(function(done) {
        db = getSchema();
        unknownId = uid.fromConnector(db) || 123;
        Post = db.define('Post', {
          title: {type: String, length: 255, index: true},
          content: {type: String},
          comments: [String],
        }, {forceId: false});
        db.automigrate('Post', done);
      });

      it('works without options on create (promise variant)', function(done) {
        var post = {id: unknownId, title: 'a', content: 'AAA'};
        Post.replaceOrCreate(post)
        .then(function(p) {
          should.exist(p);
          p.should.be.instanceOf(Post);
          p.id.should.eql(post.id);
          p.should.not.have.property('_id');
          p.title.should.equal(post.title);
          p.content.should.equal(post.content);
          return Post.findById(p.id)
          .then(function(p) {
            p.id.should.eql(post.id);
            p.id.should.not.have.property('_id');
            p.title.should.equal(p.title);
            p.content.should.equal(p.content);
            done();
          });
        })
        .catch(done);
      });

      it('works with options on create (promise variant)', function(done) {
        var post = {id: unknownId, title: 'a', content: 'AAA'};
        Post.replaceOrCreate(post, {validate: false})
        .then(function(p) {
          should.exist(p);
          p.should.be.instanceOf(Post);
          p.id.should.eql(post.id);
          p.should.not.have.property('_id');
          p.title.should.equal(post.title);
          p.content.should.equal(post.content);
          return Post.findById(p.id)
          .then(function(p) {
            p.id.should.eql(post.id);
            p.id.should.not.have.property('_id');
            p.title.should.equal(p.title);
            p.content.should.equal(p.content);
            done();
          });
        })
        .catch(done);
      });

      it('works without options on update (promise variant)', function(done) {
        var post = {title: 'a', content: 'AAA', comments: ['Comment1']};
        Post.create(post)
          .then(function(created) {
            created = created.toObject();
            delete created.comments;
            delete created.content;
            created.title = 'b';
            return Post.replaceOrCreate(created)
            .then(function(p) {
              should.exist(p);
              p.should.be.instanceOf(Post);
              p.id.should.eql(created.id);
              p.should.not.have.property('_id');
              p.title.should.equal('b');
              p.should.have.property('content', undefined);
              p.should.have.property('comments', undefined);

              return Post.findById(created.id)
              .then(function(p) {
                p.should.not.have.property('_id');
                p.title.should.equal('b');
                should.not.exist(p.content);
                should.not.exist(p.comments);
                done();
              });
            });
          })
        .catch(done);
      });

      it('works with options on update (promise variant)', function(done) {
        var post = {title: 'a', content: 'AAA', comments: ['Comment1']};
        Post.create(post)
          .then(function(created) {
            created = created.toObject();
            delete created.comments;
            delete created.content;
            created.title = 'b';
            return Post.replaceOrCreate(created, {validate: false})
            .then(function(p) {
              should.exist(p);
              p.should.be.instanceOf(Post);
              p.id.should.eql(created.id);
              p.should.not.have.property('_id');
              p.title.should.equal('b');
              p.should.have.property('content', undefined);
              p.should.have.property('comments', undefined);

              return Post.findById(created.id)
              .then(function(p) {
                p.should.not.have.property('_id');
                p.title.should.equal('b');
                should.not.exist(p.content);
                should.not.exist(p.comments);
                done();
              });
            });
          })
        .catch(done);
      });

      it('works without options on update (callback variant)', function(done) {
        Post.create({title: 'a', content: 'AAA', comments: ['Comment1']},
          function(err, post) {
            if (err) return done(err);
            post = post.toObject();
            delete post.comments;
            delete post.content;
            post.title = 'b';
            Post.replaceOrCreate(post, function(err, p) {
              if (err) return done(err);
              p.id.should.eql(post.id);
              p.should.not.have.property('_id');
              p.title.should.equal('b');
              p.should.have.property('content', undefined);
              p.should.have.property('comments', undefined);

              Post.findById(post.id, function(err, p) {
                if (err) return done(err);
                p.id.should.eql(post.id);
                p.should.not.have.property('_id');
                p.title.should.equal('b');
                should.not.exist(p.content);
                should.not.exist(p.comments);
                done();
              });
            });
          });
      });

      it('works with options on update (callback variant)', function(done) {
        Post.create({title: 'a', content: 'AAA', comments: ['Comment1']},
          {validate: false},
          function(err, post) {
            if (err) return done(err);
            post = post.toObject();
            delete post.comments;
            delete post.content;
            post.title = 'b';
            Post.replaceOrCreate(post, function(err, p) {
              if (err) return done(err);
              p.id.should.eql(post.id);
              p.should.not.have.property('_id');
              p.title.should.equal('b');
              p.should.have.property('content', undefined);
              p.should.have.property('comments', undefined);

              Post.findById(post.id, function(err, p) {
                if (err) return done(err);
                p.id.should.eql(post.id);
                p.should.not.have.property('_id');
                p.title.should.equal('b');
                should.not.exist(p.content);
                should.not.exist(p.comments);
                done();
              });
            });
          });
      });

      it('works without options on create (callback variant)', function(done) {
        var post = {id: unknownId, title: 'a', content: 'AAA'};
        Post.replaceOrCreate(post, function(err, p) {
          if (err) return done(err);
          p.id.should.eql(post.id);
          p.should.not.have.property('_id');
          p.title.should.equal(post.title);
          p.content.should.equal(post.content);

          Post.findById(p.id, function(err, p) {
            if (err) return done(err);
            p.id.should.eql(post.id);
            p.should.not.have.property('_id');
            p.title.should.equal(post.title);
            p.content.should.equal(post.content);
            done();
          });
        });
      });

      it('works with options on create (callback variant)', function(done) {
        var post = {id: unknownId, title: 'a', content: 'AAA'};
        Post.replaceOrCreate(post, {validate: false}, function(err, p) {
          if (err) return done(err);
          p.id.should.eql(post.id);
          p.should.not.have.property('_id');
          p.title.should.equal(post.title);
          p.content.should.equal(post.content);

          Post.findById(p.id, function(err, p) {
            if (err) return done(err);
            p.id.should.eql(post.id);
            p.should.not.have.property('_id');
            p.title.should.equal(post.title);
            p.content.should.equal(post.content);
            done();
          });
        });
      });
    });
  }

  var hasReplaceById = !!getSchema().connector.replaceById;

  bdd.describeIf(hasReplaceById && connectorCapabilities.supportForceId !== false, 'replaceOrCreate ' +
  'when forceId is true', function() {
    var Post, unknownId;
    before(function(done) {
      db = getSchema();
      unknownId = uid.fromConnector(db) || 123;
      Post = db.define('Post', {
        title: {type: String, length: 255},
        content: {type: String},
      }, {forceId: true});
      db.automigrate('Post', done);
    });

    it('fails when id does not exist in db', function(done) {
      var post = {id: unknownId, title: 'a', content: 'AAA'};

      Post.replaceOrCreate(post, function(err, p) {
        err.statusCode.should.equal(404);
        done();
      });
    });

    it('works on create if the request does not include an id', function(done) {
      var post = {title: 'a', content: 'AAA'};
      Post.replaceOrCreate(post, function(err, p) {
        if (err) return done(err);
        p.title.should.equal(post.title);
        p.content.should.equal(post.content);
        done();
      });
    });

    it('works on update if the request includes an existing id in db', function(done) {
      Post.create({title: 'a', content: 'AAA'},
          function(err, post) {
            if (err) return done(err);
            post = post.toObject();
            delete post.content;
            post.title = 'b';
            Post.replaceOrCreate(post, function(err, p) {
              if (err) return done(err);
              p.id.should.eql(post.id);
              done();
            });
          });
    });
  });

  if (!getSchema().connector.replaceById) {
    describe.skip('replaceAttributes/replaceById - not implemented', function() {});
  } else {
    describe('replaceAttributes', function() {
      var postInstance;
      var Post;
      var ds = getSchema();
      before(function(done) {
        Post = ds.define('Post', {
          title: {type: String, length: 255, index: true},
          content: {type: String},
          comments: [String],
        });
        ds.automigrate('Post', done);
      });
      beforeEach(function(done) {
        // TODO(bajtos) add API to lib/observer - remove observers for all hooks
        Post._observers = {};
        Post.destroyAll(function() {
          Post.create({title: 'a', content: 'AAA'}, function(err, p) {
            if (err) return done(err);
            postInstance = p;
            done();
          });
        });
      });

      it('should have updated password hashed with replaceAttributes',
      function(done) {
        StubUser.create({password: 'foo'}, function(err, created) {
          if (err) return done(err);
          created.replaceAttributes({password: 'test'}, function(err, created) {
            if (err) return done(err);
            created.password.should.equal('test-TEST');
            StubUser.findById(created.id, function(err, found) {
              if (err) return done(err);
              found.password.should.equal('test-TEST');
              done();
            });
          });
        });
      });

      it('should ignore PK if it is set for `instance`' +
      'in `before save` operation hook', function(done) {
        Post.findById(postInstance.id, function(err, p) {
          if (err) return done(err);
          changePostIdInHook('before save');
          p.replaceAttributes({title: 'b'}, function(err, data) {
            if (err) return done(err);
            data.id.should.eql(postInstance.id);
            Post.find(function(err, p) {
              if (err) return done(err);
              p[0].id.should.eql(postInstance.id);
              done();
            });
          });
        });
      });

      it('should set cannotOverwritePKInBeforeSaveHook flag, if `instance` in' +
      '`before save` operation hook is set, so we report a warning just once',
      function(done) {
        Post.findById(postInstance.id, function(err, p) {
          if (err) return done(err);
          changePostIdInHook('before save');
          p.replaceAttributes({title: 'b'}, function(err, data) {
            if (err) return done(err);
            Post._warned.cannotOverwritePKInBeforeSaveHook.should.equal(true);
            data.id.should.eql(postInstance.id);
            done();
          });
        });
      });

      it('should ignore PK if it is set for `data`' +
      'in `loaded` operation hook', function(done) {
        Post.findById(postInstance.id, function(err, p) {
          if (err) return done(err);
          changePostIdInHook('loaded');
          p.replaceAttributes({title: 'b'}, function(err, data) {
            data.id.should.eql(postInstance.id);
            if (err) return done(err);
            // clear observers to make sure `loaded`
            // hook does not affect `find()` method
            Post.clearObservers('loaded');
            Post.find(function(err, p) {
              if (err) return done(err);
              p[0].id.should.eql(postInstance.id);
              done();
            });
          });
        });
      });

      it('should set cannotOverwritePKInLoadedHook flag, if `instance` in' +
      '`before save` operation hook is set, so we report a warning just once',
      function(done) {
        Post.findById(postInstance.id, function(err, p) {
          if (err) return done(err);
          changePostIdInHook('loaded');
          p.replaceAttributes({title: 'b'}, function(err, data) {
            if (err) return done(err);
            Post._warned.cannotOverwritePKInLoadedHook.should.equal(true);
            data.id.should.eql(postInstance.id);
            done();
          });
        });
      });

      it('works without options(promise variant)', function(done) {
        Post.findById(postInstance.id)
      .then(function(p) {
        p.replaceAttributes({title: 'b'})
        .then(function(p) {
          should.exist(p);
          p.should.be.instanceOf(Post);
          p.title.should.equal('b');
          p.should.have.property('content', undefined);
          return Post.findById(postInstance.id)
          .then(function(p) {
            p.title.should.equal('b');
            should.not.exist(p.content);
            done();
          });
        });
      })
      .catch(done);
      });

      it('works with options(promise variant)', function(done) {
        Post.findById(postInstance.id)
      .then(function(p) {
        p.replaceAttributes({title: 'b'}, {validate: false})
        .then(function(p) {
          should.exist(p);
          p.should.be.instanceOf(Post);
          p.title.should.equal('b');
          p.should.have.property('content', undefined);
          return Post.findById(postInstance.id)
          .then(function(p) {
            p.title.should.equal('b');
            should.not.exist(p.content);
            done();
          });
        });
      })
      .catch(done);
      });

      it('should fail when changing id', function(done) {
        var unknownId = uid.fromConnector(db) || 999;
        Post.findById(postInstance.id, function(err, p) {
          if (err) return done(err);
          p.replaceAttributes({title: 'b', id: unknownId}, function(err, p) {
            should.exist(err);
            var expectedErrMsg = 'id property (id) cannot be updated from ' +
              postInstance.id + ' to ' + unknownId;
            err.message.should.equal(expectedErrMsg);
            done();
          });
        });
      });

      it('works without options(callback variant)', function(done) {
        Post.findById(postInstance.id, function(err, p) {
          if (err) return done(err);
          p.replaceAttributes({title: 'b'}, function(err, p) {
            if (err) return done(err);
            p.should.have.property('content', undefined);
            p.title.should.equal('b');
            done();
          });
        });
      });

      it('works with options(callback variant)', function(done) {
        Post.findById(postInstance.id, function(err, p) {
          if (err) return done(err);
          p.replaceAttributes({title: 'b'}, {validate: false}, function(err, p) {
            if (err) return done(err);
            p.should.have.property('content', undefined);
            p.title.should.equal('b');
            done();
          });
        });
      });

      function changePostIdInHook(operationHook) {
        Post.observe(operationHook, function(ctx, next) {
          (ctx.data || ctx.instance).id = 99;
          next();
        });
      }
    });
  }

  hasReplaceById = !!getSchema().connector.replaceById;
  bdd.describeIf(hasReplaceById, 'replaceById', function() {
    var Post;
    before(function(done) {
      db = getSchema();
      Post = db.define('Post', {
        title: {type: String, length: 255},
        content: {type: String},
      }, {forceId: true});
      db.automigrate('Post', done);
    });

    bdd.itIf(connectorCapabilities.supportForceId !== false, 'fails when id does not exist in db ' +
    'using replaceById', function(done) {
      var unknownId = uid.fromConnector(db) || 123;
      var post = {id: unknownId, title: 'a', content: 'AAA'};
      Post.replaceById(post.id, post, function(err, p) {
        err.statusCode.should.equal(404);
        done();
      });
    });
  });

  describe('findOrCreate', function() {
    it('should create a record with if new', function(done) {
      Person.findOrCreate({name: 'Zed', gender: 'male'},
        function(err, p, created) {
          if (err) return done(err);
          should.exist(p);
          p.should.be.instanceOf(Person);
          p.name.should.equal('Zed');
          p.gender.should.equal('male');
          created.should.equal(true);
          done();
        });
    });

    it('should find a record if exists', function(done) {
      Person.findOrCreate(
        {where: {name: 'Zed'}},
        {name: 'Zed', gender: 'male'},
        function(err, p, created) {
          if (err) return done(err);
          should.exist(p);
          p.should.be.instanceOf(Person);
          p.name.should.equal('Zed');
          p.gender.should.equal('male');
          created.should.equal(false);
          done();
        });
    });

    it('should create a record with if new (promise variant)', function(done) {
      Person.findOrCreate({name: 'Jed', gender: 'male'})
        .then(function(res) {
          should.exist(res);
          res.should.be.instanceOf(Array);
          res.should.have.lengthOf(2);
          var p = res[0];
          var created = res[1];
          p.should.be.instanceOf(Person);
          p.name.should.equal('Jed');
          p.gender.should.equal('male');
          created.should.equal(true);
          done();
        })
        .catch(done);
    });

    it('should find a record if exists (promise variant)', function(done) {
      Person.findOrCreate(
        {where: {name: 'Jed'}},
        {name: 'Jed', gender: 'male'})
      .then(function(res) {
        res.should.be.instanceOf(Array);
        res.should.have.lengthOf(2);
        var p = res[0];
        var created = res[1];
        p.should.be.instanceOf(Person);
        p.name.should.equal('Jed');
        p.gender.should.equal('male');
        created.should.equal(false);
        done();
      })
      .catch(done);
    });
  });

  describe('destroy', function() {
    it('should destroy record', function(done) {
      Person.create(function(err, p) {
        if (err) return done(err);
        p.destroy(function(err) {
          if (err) return done(err);
          Person.exists(p.id, function(err, ex) {
            if (err) return done(err);
            ex.should.not.be.ok;
            done();
          });
        });
      });
    });

    it('should destroy record (promise variant)', function(done) {
      Person.create()
        .then(function(p) {
          return p.destroy()
            .then(function() {
              return Person.exists(p.id)
                .then(function(ex) {
                  ex.should.not.be.ok;
                  done();
                });
            });
        })
        .catch(done);
    });

    it('should destroy all records', function(done) {
      Person.destroyAll(function(err) {
        if (err) return done(err);
        Person.all(function(err, posts) {
          if (err) return done(err);
          posts.should.have.lengthOf(0);
          Person.count(function(err, count) {
            if (err) return done(err);
            count.should.eql(0);
            done();
          });
        });
      });
    });

    it('should destroy all records (promise variant)', function(done) {
      Person.create()
        .then(function() {
          return Person.destroyAll()
            .then(function() {
              return Person.all()
                .then(function(ps) {
                  ps.should.have.lengthOf(0);
                  return Person.count()
                    .then(function(count) {
                      count.should.eql(0);
                      done();
                    });
                });
            });
        })
        .catch(done);
    });

    // TODO: implement destroy with filtered set
    it('should destroy filtered set of records');
  });

  bdd.describeIf(connectorCapabilities.reportDeletedCount !== false &&
  connectorCapabilities.deleteWithOtherThanId !== false, 'deleteAll/destroyAll', function() {
    beforeEach(function clearOldData(done) {
      Person.deleteAll(done);
    });

    beforeEach(function createTestData(done) {
      Person.create([{
        name: 'John',
      }, {
        name: 'Jane',
      }], function(err, data) {
        should.not.exist(err);
        done();
      });
    });

    it('should be defined as function', function() {
      Person.deleteAll.should.be.a.Function;
      Person.destroyAll.should.be.a.Function;
    });

    it('should only delete instances that satisfy the where condition',
        function(done) {
          Person.deleteAll({name: 'John'}, function(err, info) {
            if (err) return done(err);
            info.should.have.property('count', 1);
            Person.find({where: {name: 'John'}}, function(err, data) {
              if (err) return done(err);
              data.should.have.length(0);
              Person.find({where: {name: 'Jane'}}, function(err, data) {
                if (err) return done(err);
                data.should.have.length(1);
                done();
              });
            });
          });
        });

    it('should report zero deleted instances when no matches are found',
        function(done) {
          Person.deleteAll({name: 'does-not-match'}, function(err, info) {
            if (err) return done(err);
            info.should.have.property('count', 0);
            Person.count(function(err, count) {
              if (err) return done(err);
              count.should.equal(2);
              done();
            });
          });
        });

    it('should delete all instances when the where condition is not provided',
        function(done) {
          Person.deleteAll(function(err, info) {
            if (err) return done(err);
            info.should.have.property('count', 2);
            Person.count(function(err, count) {
              if (err) return done(err);
              count.should.equal(0);
              done();
            });
          });
        });
  });

  bdd.describeIf(connectorCapabilities.reportDeletedCount === false &&
  connectorCapabilities.deleteWithOtherThanId === false, 'deleteAll/destroyAll case 2', function() {
    var idJohn, idJane;
    beforeEach(function clearOldData(done) {
      Person.deleteAll(done);
    });

    beforeEach(function createTestData(done) {
      Person.create([{
        name: 'John',
      }, {
        name: 'Jane',
      }], function(err, data) {
        should.not.exist(err);
        data.forEach(function(person) {
          if (person.name === 'John') idJohn = person.id;
          if (person.name === 'Jane') idJane = person.id;
        });
        should.exist(idJohn);
        should.exist(idJane);
        done();
      });
    });

    it('should be defined as function', function() {
      Person.deleteAll.should.be.a.Function;
      Person.destroyAll.should.be.a.Function;
    });

    it('should only delete instances that satisfy the where condition',
        function(done) {
          Person.deleteAll({id: idJohn}, function(err, info) {
            if (err) return done(err);
            should.not.exist(info.count);
            Person.find({where: {name: 'John'}}, function(err, data) {
              if (err) return done(err);
              should.not.exist(data.count);
              data.should.have.length(0);
              Person.find({where: {name: 'Jane'}}, function(err, data) {
                if (err) return done(err);
                data.should.have.length(1);
                done();
              });
            });
          });
        });

    it('should report zero deleted instances when no matches are found',
        function(done) {
          var unknownId = uid.fromConnector(db) || 1234567890;
          Person.deleteAll({id: unknownId}, function(err, info) {
            if (err) return done(err);
            should.not.exist(info.count);
            Person.count(function(err, count) {
              if (err) return done(err);
              count.should.equal(2);
              done();
            });
          });
        });

    it('should delete all instances when the where condition is not provided',
        function(done) {
          Person.deleteAll(function(err, info) {
            if (err) return done(err);
            should.not.exist(info.count);
            Person.count(function(err, count) {
              if (err) return done(err);
              count.should.equal(0);
              done();
            });
          });
        });
  });

  describe('deleteById', function() {
    beforeEach(givenSomePeople);
    afterEach(function() {
      Person.settings.strictDelete = false;
    });

    it('should allow deleteById(id) - success', function(done) {
      Person.findOne(function(e, p) {
        Person.deleteById(p.id, function(err, info) {
          if (err) return done(err);
          if (connectorCapabilities.reportDeletedCount !== false) {
            info.should.have.property('count', 1);
          } else {
            should.not.exist(info.count);
          }
          done();
        });
      });
    });

    it('should allow deleteById(id) - fail', function(done) {
      var unknownId = uid.fromConnector(db) || 9999;
      Person.settings.strictDelete = false;
      Person.deleteById(unknownId, function(err, info) {
        if (err) return done(err);
        if (connectorCapabilities.reportDeletedCount !== false) {
          info.should.have.property('count', 0);
        } else {
          should.not.exist(info.count);
        }
        done();
      });
    });

    it('should allow deleteById(id) - fail with error', function(done) {
      var unknownId = uid.fromConnector(db) || 9999;
      var errMsg = 'No instance with id ' + unknownId.toString() + ' found for Person';
      Person.settings.strictDelete = true;
      Person.deleteById(unknownId, function(err) {
        should.exist(err);
        err.message.should.equal(errMsg);
        err.should.have.property('code', 'NOT_FOUND');
        err.should.have.property('statusCode', 404);
        done();
      });
    });
  });

  describe('prototype.delete', function() {
    beforeEach(givenSomePeople);
    afterEach(function() {
      Person.settings.strictDelete = false;
    });

    it('should allow delete(id) - success', function(done) {
      Person.findOne(function(e, p) {
        if (e) return done(e);
        p.delete(function(err, info) {
          if (err) return done(err);
          if (connectorCapabilities.reportDeletedCount !== false) {
            info.should.have.property('count', 1);
          } else {
            should.not.exist(info.count);
          }
          done();
        });
      });
    });

    it('should allow delete(id) - fail', function(done) {
      Person.settings.strictDelete = false;
      Person.findOne(function(e, p) {
        if (e) return done(e);
        p.delete(function(err, info) {
          if (err) return done(err);
          if (connectorCapabilities.reportDeletedCount !== false) {
            info.should.have.property('count', 1);
          } else {
            should.not.exist(info.count);
          }
          p.delete(function(err, info) {
            if (err) return done(err);
            if (connectorCapabilities.reportDeletedCount !== false) {
              info.should.have.property('count', 0);
            } else {
              should.not.exist(info.count);
            }
            done();
          });
        });
      });
    });

    bdd.itIf(connectorCapabilities.supportStrictDelete !== false, 'should allow delete(id) - ' +
    'fail with error', function(done) {
      Person.settings.strictDelete = true;
      Person.findOne(function(err, u) {
        if (err) return done(err);
        u.delete(function(err, info) {
          if (err) return done(err);
          info.should.have.property('count', 1);
          u.delete(function(err) {
            should.exist(err);
            err.message.should.equal('No instance with id ' + u.id + ' found for Person');
            err.should.have.property('code', 'NOT_FOUND');
            err.should.have.property('statusCode', 404);
            done();
          });
        });
      });
    });
  });

  describe('initialize', function() {
    it('should initialize object properly', function() {
      var hw = 'Hello word',
        now = Date.now(),
        person = new Person({name: hw});

      person.name.should.equal(hw);
      person.name = 'Goodbye, Lenin';
      (person.createdAt >= now).should.be.true;
      person.isNewRecord().should.be.true;
    });

    describe('Date $now function', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel1', {
          createdAt: {type: Date, default: '$now'},
        });
        db.automigrate('CustomModel1', done);
      });

      it('should report current date as default value for date property',
        function(done) {
          var now = Date.now();

          CustomModel.create(function(err, model) {
            should.not.exists(err);
            model.createdAt.should.be.instanceOf(Date);
            (model.createdAt >= now).should.be.true;
          });

          done();
        });
    });

    describe('Date $now function', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel2', {
          now: {type: String, default: '$now'},
        });
        db.automigrate('CustomModel2', done);
      });

      it('should report \'$now\' as default value for string property',
        function(done) {
          CustomModel.create(function(err, model) {
            if (err) return done(err);
            model.now.should.be.instanceOf(String);
            model.now.should.equal('$now');
          });

          done();
        });
    });

    describe('now defaultFn', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel3', {
          now: {type: Date, defaultFn: 'now'},
        });
        db.automigrate('CustomModel3', done);
      });

      it('should generate current time when "defaultFn" is "now"',
        function(done) {
          var now = Date.now();
          CustomModel.create(function(err, model) {
            if (err) return done(err);
            model.now.should.be.instanceOf(Date);
            model.now.should.be.within(now, now + 200);
            done();
          });
        });
    });

    describe('guid defaultFn', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel4', {
          guid: {type: String, defaultFn: 'guid'},
        });
        db.automigrate('CustomModel4', done);
      });

      it('should generate a new id when "defaultFn" is "guid"', function(done) {
        CustomModel.create(function(err, model) {
          if (err) return done(err);
          model.guid.should.match(UUID_REGEXP);
          done();
        });
      });
    });

    describe('uuid defaultFn', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel5', {
          guid: {type: String, defaultFn: 'uuid'},
        });
        db.automigrate('CustomModel5', done);
      });

      it('should generate a new id when "defaultfn" is "uuid"', function(done) {
        CustomModel.create(function(err, model) {
          if (err) return done(err);
          model.guid.should.match(UUID_REGEXP);
          done();
        });
      });
    });

    describe('uuidv4 defaultFn', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel5', {
          guid: {type: String, defaultFn: 'uuidv4'},
        });
        db.automigrate('CustomModel5', done);
      });

      it('should generate a new id when "defaultfn" is "uuidv4"', function(done) {
        CustomModel.create(function(err, model) {
          should.not.exists(err);
          model.guid.should.match(UUID_REGEXP);
          done();
        });
      });
    });

    describe('shortid defaultFn', function() {
      var ModelWithShortId;
      before(createModelWithShortId);

      it('should generate a new id when "defaultFn" is "shortid"', function(done) {
        var SHORTID_REGEXP = /^[0-9a-z_\-]{7,14}$/i;
        ModelWithShortId.create(function(err, modelWithShortId) {
          if (err) return done(err);
          modelWithShortId.shortid.should.match(SHORTID_REGEXP);
          done();
        });
      });

      function createModelWithShortId(cb) {
        ModelWithShortId = db.define('ModelWithShortId', {
          shortid: {type: String, defaultFn: 'shortid'},
        });
        db.automigrate('ModelWithShortId', cb);
      }
    });

    // it('should work when constructor called as function', function() {
    //     var p = Person({name: 'John Resig'});
    //     p.should.be.an.instanceOf(Person);
    //     p.name.should.equal('John Resig');
    // });
  });

  describe('property value coercion', function() {
    it('should coerce boolean types properly', function() {
      var p1 = new Person({name: 'John', married: 'false'});
      p1.married.should.equal(false);

      p1 = new Person({name: 'John', married: 'true'});
      p1.married.should.equal(true);

      p1 = new Person({name: 'John', married: '1'});
      p1.married.should.equal(true);

      p1 = new Person({name: 'John', married: '0'});
      p1.married.should.equal(false);

      p1 = new Person({name: 'John', married: true});
      p1.married.should.equal(true);

      p1 = new Person({name: 'John', married: false});
      p1.married.should.equal(false);

      p1 = new Person({name: 'John', married: 'null'});
      p1.married.should.equal(true);

      p1 = new Person({name: 'John', married: ''});
      p1.married.should.equal(false);

      p1 = new Person({name: 'John', married: 'X'});
      p1.married.should.equal(true);

      p1 = new Person({name: 'John', married: 0});
      p1.married.should.equal(false);

      p1 = new Person({name: 'John', married: 1});
      p1.married.should.equal(true);

      p1 = new Person({name: 'John', married: null});
      p1.should.have.property('married', null);

      p1 = new Person({name: 'John', married: undefined});
      p1.should.have.property('married', undefined);
    });

    it('should coerce date types properly', function() {
      var p1 = new Person({name: 'John', dob: '2/1/2015'});
      p1.dob.should.eql(new Date('2/1/2015'));

      p1 = new Person({name: 'John', dob: '2/1/2015'});
      p1.dob.should.eql(new Date('2/1/2015'));

      p1 = new Person({name: 'John', dob: '12'});
      p1.dob.should.eql(new Date('12'));

      p1 = new Person({name: 'John', dob: 12});
      p1.dob.should.eql(new Date(12));

      p1 = new Person({name: 'John', dob: null});
      p1.should.have.property('dob', null);

      p1 = new Person({name: 'John', dob: undefined});
      p1.should.have.property('dob', undefined);

      p1 = new Person({name: 'John', dob: 'X'});
      p1.should.have.property('dob');
      p1.dob.toString().should.be.eql('Invalid Date');
    });
  });

  describe('update/updateAll', function() {
    var idBrett, idCarla, idDonna, idFrank, idGrace, idHarry;
    var filterBrett, filterHarry;

    beforeEach(function clearOldData(done) {
      db = getSchema();
      Person.destroyAll(done);
    });

    beforeEach(function createTestData(done) {
      Person.create([{
        name: 'Brett Boe',
        age: 19,
      }, {
        name: 'Carla Coe',
        age: 20,
      }, {
        name: 'Donna Doe',
        age: 21,
      }, {
        name: 'Frank Foe',
        age: 22,
      }, {
        name: 'Grace Goe',
        age: 23,
      }], function(err, data) {
        should.not.exist(err);
        data.forEach(function(person) {
          if (person.name === 'Brett Boe') idBrett = person.id;
          if (person.name === 'Carla Coe') idCarla = person.id;
          if (person.name === 'Donna Doe') idDonna = person.id;
          if (person.name === 'Frank Foe') idFrank = person.id;
          if (person.name === 'Grace Goe') idGrace = person.id;
        });
        should.exist(idBrett);
        should.exist(idCarla);
        should.exist(idDonna);
        should.exist(idFrank);
        should.exist(idGrace);
        done();
      });
    });

    it('should be defined as a function', function() {
      Person.update.should.be.a.Function;
      Person.updateAll.should.be.a.Function;
    });

    it('should not update instances that do not satisfy the where condition',
        function(done) {
          idHarry = uid.fromConnector(db) || undefined;
          var filter = connectorCapabilities.updateWithOtherThanId === false ?
            {id: idHarry} : {name: 'Harry Hoe'};
          Person.update(filter, {name: 'Marta Moe'}, function(err,
          info) {
            if (err) return done(err);
            if (connectorCapabilities.reportDeletedCount !== false) {
              info.should.have.property('count', 0);
            } else {
              should.not.exist(info.count);
            }
            Person.find({where: {name: 'Harry Hoe'}}, function(err, people) {
              if (err) return done(err);
              people.should.be.empty;
              done();
            });
          });
        });

    it('should only update instances that satisfy the where condition',
        function(done) {
          var filter = connectorCapabilities.deleteWithOtherThanId === false ?
            {id: idBrett} : {name: 'Brett Boe'};
          Person.update(filter, {name: 'Harry Hoe'}, function(err,
          info) {
            if (err) return done(err);
            if (connectorCapabilities.reportDeletedCount !== false) {
              info.should.have.property('count', 1);
            } else {
              should.not.exist(info.count);
            }
            Person.find({where: {age: 19}}, function(err, people) {
              if (err) return done(err);
              people.should.have.length(1);
              people[0].name.should.equal('Harry Hoe');
              done();
            });
          });
        });

    bdd.itIf(connectorCapabilities.updateWithoutId !== false, 'should update all instances when ' +
    'the where condition is not provided', function(done) {
      filterHarry = connectorCapabilities.deleteWithOtherThanId === false ?
        {id: idHarry} : {name: 'Harry Hoe'};
      filterBrett = connectorCapabilities.deleteWithOtherThanId === false ?
        {id: idBrett} : {name: 'Brett Boe'};
      Person.update(filterHarry, function(err, info) {
        if (err) return done(err);
        info.should.have.property('count', 5);
        Person.find({where: filterBrett}, function(err, people) {
          if (err) return done(err);
          people.should.be.empty();
          Person.find({where: filterHarry}, function(err, people) {
            if (err) return done(err);
            people.should.have.length(5);
            done();
          });
        });
      });
    });

    bdd.itIf(connectorCapabilities.ignoreUndefinedConditionValue !== false, 'should ignore where ' +
    'conditions with undefined values', function(done) {
      Person.update(filterBrett, {name: undefined, gender: 'male'},
      function(err, info) {
        if (err) return done(err);
        info.should.have.property('count', 1);
        Person.find({where: filterBrett}, function(err, people) {
          if (err) return done(err);
          people.should.have.length(1);
          people[0].name.should.equal('Brett Boe');
          done();
        });
      });
    });

    it('should not coerce invalid values provided in where conditions', function(done) {
      Person.update({name: 'Brett Boe'}, {dob: 'notadate'}, function(err) {
        should.exist(err);
        err.message.should.equal('Invalid date: notadate');
        done();
      });
    });
  });

  describe('upsertWithWhere', function() {
    var ds = getSchema();
    var Person;
    before('prepare "Person" model', function(done) {
      Person = ds.define('Person', {
        id: {type: Number, id: true},
        name: {type: String},
        city: {type: String},
      });
      ds.automigrate('Person', done);
    });

    it('has an alias "patchOrCreateWithWhere"', function() {
      StubUser.upsertWithWhere.should.equal(StubUser.patchOrCreateWithWhere);
    });

    it('should preserve properties with dynamic setters on create', function(done) {
      StubUser.upsertWithWhere({password: 'foo'}, {password: 'foo'}, function(err, created) {
        if (err) return done(err);
        created.password.should.equal('foo-FOO');
        StubUser.findById(created.id, function(err, found) {
          if (err) return done(err);
          found.password.should.equal('foo-FOO');
          done();
        });
      });
    });

    it('should preserve properties with dynamic setters on update', function(done) {
      StubUser.create({password: 'foo'}, function(err, created) {
        if (err) return done(err);
        var data = {password: 'bar'};
        StubUser.upsertWithWhere({id: created.id}, data, function(err, updated) {
          if (err) return done(err);
          updated.password.should.equal('bar-BAR');
          StubUser.findById(created.id, function(err, found) {
            if (err) return done(err);
            found.password.should.equal('bar-BAR');
            done();
          });
        });
      });
    });

    it('should preserve properties with "undefined" value', function(done) {
      Person.create(
        {id: 10, name: 'Ritz', city: undefined},
        function(err, instance) {
          if (err) return done(err);
          instance.toObject().should.have.properties({
            id: 10,
            name: 'Ritz',
            city: undefined,
          });

          Person.upsertWithWhere({id: 10},
            {name: 'updated name'},
              function(err, updated) {
                if (err) return done(err);
                var result = updated.toObject();
                result.should.have.properties({
                  id: instance.id,
                  name: 'updated name',
                });
                should.equal(result.city, null);
                done();
              });
        });
    });

    it('should allow save() of the created instance', function(done) {
      Person.upsertWithWhere({id: 999},
        // Todo @mountain: This seems a bug why in data object still I need to pass id?
        {id: 999, name: 'a-name'},
        function(err, inst) {
          if (err) return done(err);
          inst.save(done);
        });
    });

    it('works without options on create (promise variant)', function(done) {
      var person = {id: 123, name: 'a', city: 'city a'};
      Person.upsertWithWhere({id: 123}, person)
        .then(function(p) {
          should.exist(p);
          p.should.be.instanceOf(Person);
          p.id.should.eql(person.id);
          p.should.not.have.property('_id');
          p.name.should.equal(person.name);
          p.city.should.equal(person.city);
          return Person.findById(p.id)
            .then(function(p) {
              p.id.should.eql(person.id);
              p.id.should.not.have.property('_id');
              p.name.should.equal(person.name);
              p.city.should.equal(person.city);
              done();
            });
        })
        .catch(done);
    });

    it('works with options on create (promise variant)', function(done) {
      var person = {id: 234, name: 'b', city: 'city b'};
      Person.upsertWithWhere({id: 234}, person, {validate: false})
        .then(function(p) {
          should.exist(p);
          p.should.be.instanceOf(Person);
          p.id.should.eql(person.id);
          p.should.not.have.property('_id');
          p.name.should.equal(person.name);
          p.city.should.equal(person.city);
          return Person.findById(p.id)
            .then(function(p) {
              p.id.should.eql(person.id);
              p.id.should.not.have.property('_id');
              p.name.should.equal(person.name);
              p.city.should.equal(person.city);
              done();
            });
        })
        .catch(done);
    });

    it('works without options on update (promise variant)', function(done) {
      var person = {id: 456, name: 'AAA', city: 'city AAA'};
      Person.create(person)
        .then(function(created) {
          created = created.toObject();
          delete created.city;
          created.name = 'BBB';
          return Person.upsertWithWhere({id: 456}, created)
            .then(function(p) {
              should.exist(p);
              p.should.be.instanceOf(Person);
              p.id.should.eql(created.id);
              p.should.not.have.property('_id');
              p.name.should.equal('BBB');
              p.should.have.property('city', 'city AAA');
              return Person.findById(created.id)
                .then(function(p) {
                  p.should.not.have.property('_id');
                  p.name.should.equal('BBB');
                  p.city.should.equal('city AAA');
                  done();
                });
            });
        })
        .catch(done);
    });

    it('works with options on update (promise variant)', function(done) {
      var person = {id: 789, name: 'CCC', city: 'city CCC'};
      Person.create(person)
        .then(function(created) {
          created = created.toObject();
          delete created.city;
          created.name = 'Carlton';
          return Person.upsertWithWhere({id: 789}, created, {validate: false})
            .then(function(p) {
              should.exist(p);
              p.should.be.instanceOf(Person);
              p.id.should.eql(created.id);
              p.should.not.have.property('_id');
              p.name.should.equal('Carlton');
              p.should.have.property('city', 'city CCC');
              return Person.findById(created.id)
                .then(function(p) {
                  p.should.not.have.property('_id');
                  p.name.should.equal('Carlton');
                  p.city.should.equal('city CCC');
                  done();
                });
            });
        })
        .catch(done);
    });

    it('fails the upsertWithWhere operation when data object is empty', function(done) {
      var options = {};
      Person.upsertWithWhere({name: 'John Lennon'}, {}, options,
        function(err) {
          err.message.should.equal('data object cannot be empty!');
          done();
        });
    });

    it('creates a new record when no matching instance is found', function(done) {
      Person.upsertWithWhere({city: 'Florida'}, {name: 'Nick Carter', id: 1, city: 'Florida'},
        function(err, created) {
          if (err) return done(err);
          Person.findById(1, function(err, data) {
            if (err) return done(err);
            data.id.should.equal(1);
            data.name.should.equal('Nick Carter');
            data.city.should.equal('Florida');
            done();
          });
        });
    });

    it('fails the upsertWithWhere operation when multiple instances are ' +
        'retrieved based on the filter criteria', function(done) {
      Person.create([
        {id: '2', name: 'Howie', city: 'Florida'},
        {id: '3', name: 'Kevin', city: 'Florida'},
      ], function(err, instance) {
        if (err) return done(err);
        Person.upsertWithWhere({city: 'Florida'}, {
          id: '4', name: 'Brian',
        }, function(err) {
          err.message.should.equal('There are multiple instances found.' +
              'Upsert Operation will not be performed!');
          done();
        });
      });
    });

    it('updates the record when one matching instance is found ' +
        'based on the filter criteria', function(done) {
      Person.create([
        {id: '5', name: 'Howie', city: 'Kentucky'},
      ], function(err, instance) {
        if (err) return done(err);
        Person.upsertWithWhere({city: 'Kentucky'}, {
          name: 'Brian',
        }, {validate: false}, function(err, instance) {
          if (err) return done(err);
          Person.findById(5, function(err, data) {
            if (err) return done(err);
            should.equal(data.id, 5);
            data.name.should.equal('Brian');
            data.city.should.equal('Kentucky');
            done();
          });
        });
      });
    });
  });
});

function givenSomePeople(done) {
  var beatles = [
    {name: 'John Lennon', gender: 'male'},
    {name: 'Paul McCartney', gender: 'male'},
    {name: 'George Harrison', gender: 'male'},
    {name: 'Ringo Starr', gender: 'male'},
    {name: 'Pete Best', gender: 'male'},
    {name: 'Stuart Sutcliffe', gender: 'male'},
  ];

  async.series([
    Person.destroyAll.bind(Person),
    function(cb) {
      async.each(beatles, Person.create.bind(Person), cb);
    },
  ], done);
}
