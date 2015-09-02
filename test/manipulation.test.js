// This test written in mocha+should.js
var async = require('async');
var should = require('./init.js');

var db, Person;
var ValidationError = require('..').ValidationError;

var UUID_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('manipulation', function () {

  before(function (done) {
    db = getSchema();

    Person = db.define('Person', {
      name: String,
      gender: String,
      married: Boolean,
      age: {type: Number, index: true},
      dob: Date,
      createdAt: {type: Date, default: Date}
    }, { forceId: true, strict: true });

    db.automigrate(['Person'], done);

  });

  // A simplified implementation of LoopBack's User model
  // to reproduce problems related to properties with dynamic setters
  // For the purpose of the tests, we use a counter instead of a hash fn.
  var StubUser;
  before(function setupStubUserModel(done) {
    StubUser = db.createModel('StubUser', { password: String }, { forceId: true });
    StubUser.setter.password = function(plain) {
      this.$password = plain + '-' + plain.toUpperCase();
    };
    db.automigrate('StubUser', done);
  });

  beforeEach(function resetStubPasswordCounter() {
    stubPasswordCounter = 0;
  });

  describe('create', function () {

    before(function (done) {
      Person.destroyAll(done);
    });

    it('should create instance', function (done) {
      Person.create({name: 'Anatoliy'}, function (err, p) {
        p.name.should.equal('Anatoliy');
        should.not.exist(err);
        should.exist(p);
        Person.findById(p.id, function (err, person) {
          person.id.should.eql(p.id);
          person.name.should.equal('Anatoliy');
          done();
        });
      });
    });

    it('should create instance (promise variant)', function (done) {
      Person.create({name: 'Anatoliy'})
        .then (function (p) {
          p.name.should.equal('Anatoliy');
          should.exist(p);
          return Person.findById(p.id)
            .then (function (person) {
              person.id.should.eql(p.id);
              person.name.should.equal('Anatoliy');
              done();
            });
        })
        .catch(done);
    });

    it('should instantiate an object', function (done) {
      var p = new Person({name: 'Anatoliy'});
      p.name.should.equal('Anatoliy');
      p.isNewRecord().should.be.true;
      p.save(function(err, inst) {
        should.not.exist(err);
        inst.isNewRecord().should.be.false;
        inst.should.equal(p);
        done();
      });
    });

    it('should instantiate an object (promise variant)', function (done) {
      var p = new Person({name: 'Anatoliy'});
      p.name.should.equal('Anatoliy');
      p.isNewRecord().should.be.true;
      p.save()
        .then (function(inst) {
          inst.isNewRecord().should.be.false;
          inst.should.equal(p);
          done();
        })
        .catch(done);

    });

    it('should return instance of object', function (done) {
      var person = Person.create(function (err, p) {
        p.id.should.eql(person.id);
        done();
      });
      should.exist(person);
      person.should.be.an.instanceOf(Person);
      should.not.exist(person.id);
    });

    it('should not allow user-defined value for the id of object - create', function (done) {
      Person.create({id: 123456}, function (err, p) {
        err.should.be.instanceof(ValidationError);
        err.statusCode.should.equal(422);
        err.details.messages.id.should.eql(['can\'t be set']);
        p.should.be.instanceof(Person);
        p.id.should.equal(123456);
        p.isNewRecord().should.be.true;
        done();
      });
    });

    it('should not allow user-defined value for the id of object - create (promise variant)', function (done) {
      Person.create({id: 123456})
        .then (function (p) {
          done(new Error('Person.create should have failed.'));
        }, function (err) {
          err.should.be.instanceof(ValidationError);
          err.statusCode.should.equal(422);
          err.details.messages.id.should.eql(['can\'t be set']);
          done();
        })
        .catch(done);
    });

    it('should not allow user-defined value for the id of object - save', function (done) {
      var p = new Person({id: 123456});
      p.isNewRecord().should.be.true;
      p.save(function(err, inst) {
        err.should.be.instanceof(ValidationError);
        err.statusCode.should.equal(422);
        err.details.messages.id.should.eql(['can\'t be set']);
        inst.id.should.equal(123456);
        inst.isNewRecord().should.be.true;
        done();
      });
    });

    it('should not allow user-defined value for the id of object - save (promise variant)', function (done) {
      var p = new Person({id: 123456});
      p.isNewRecord().should.be.true;
      p.save()
        .then (function(inst) {
          done(new Error('save should have failed.'));
        }, function (err) {
          err.should.be.instanceof(ValidationError);
          err.statusCode.should.equal(422);
          err.details.messages.id.should.eql(['can\'t be set']);
          done();
        })
        .catch(done);
    });

    it('should work when called without callback', function (done) {
      Person.afterCreate = function (next) {
        this.should.be.an.instanceOf(Person);
        this.name.should.equal('Nickolay');
        should.exist(this.id);
        Person.afterCreate = null;
        next();
        setTimeout(done, 10);
      };
      Person.create({name: 'Nickolay'});
    });

    it('should create instance with blank data', function (done) {
      Person.create(function (err, p) {
        should.not.exist(err);
        should.exist(p);
        should.not.exists(p.name);
        Person.findById(p.id, function (err, person) {
          person.id.should.eql(p.id);
          should.not.exists(person.name);
          done();
        });
      });
    });

    it('should create instance with blank data (promise variant)', function (done) {
      Person.create()
        .then (function (p) {
          should.exist(p);
          should.not.exists(p.name);
          return Person.findById(p.id)
          .then (function (person) {
            person.id.should.eql(p.id);
            should.not.exists(person.name);
            done();
          });
        }).catch(done);
    });

    it('should work when called with no data and callback', function (done) {
      Person.afterCreate = function (next) {
        this.should.be.an.instanceOf(Person);
        should.not.exist(this.name);
        should.exist(this.id);
        Person.afterCreate = null;
        next();
        setTimeout(done, 30);
      };
      Person.create();
    });

    it('should create batch of objects', function (done) {
      var batch = [
        {name: 'Shaltay'},
        {name: 'Boltay'},
        {}
      ];
      Person.create(batch,function (e, ps) {
        should.not.exist(e);
        should.exist(ps);
        ps.should.be.instanceOf(Array);
        ps.should.have.lengthOf(batch.length);

        Person.validatesPresenceOf('name');
        Person.create(batch,function (errors, persons) {
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
        }).should.be.instanceOf(Array);
      }).should.have.lengthOf(3);
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
        undefined
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
        { name: 'a-name', gender: undefined },
        function(err, created) {
          if (err) return done(err);
          created.toObject().should.have.properties({
            id: created.id,
            name: 'a-name',
            gender: undefined
          });

          Person.findById(created.id, function(err, found) {
            if (err) return done(err);
            var result = found.toObject();
            result.should.have.properties({
              id: created.id,
              name: 'a-name'
            });
            // The gender can be null from a RDB
            should.equal(result.gender, null);
            done();
          });
        });
    });

    it('should refuse to create object with duplicate id', function(done) {
      // NOTE(bajtos) We cannot reuse Person model here,
      // `settings.forceId` aborts the CREATE request at the validation step.
      var Product = db.define('ProductTest', { name: String });
      db.automigrate('ProductTest', function(err) {
        if (err) return done(err);

        Product.create({ name: 'a-name' }, function(err, p) {
          if (err) return done(err);
          Product.create({ id: p.id, name: 'duplicate' }, function(err) {
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

  describe('save', function () {

    it('should save new object', function (done) {
      var p = new Person;
      p.save(function (err) {
        should.not.exist(err);
        should.exist(p.id);
        done();
      });
    });

    it('should save new object (promise variant)', function (done) {
      var p = new Person;
      p.save()
        .then(function () {
          should.exist(p.id);
          done();
        })
        .catch(done);
    });

    it('should save existing object', function (done) {
      Person.findOne(function (err, p) {
        should.not.exist(err);
        p.name = 'Hans';
        p.save(function (err) {
          should.not.exist(err);
          p.name.should.equal('Hans');
          Person.findOne(function (err, p) {
            should.not.exist(err);
            p.name.should.equal('Hans');
            done();
          });
        });
      });
    });

    it('should save existing object (promise variant)', function (done) {
      Person.findOne()
        .then(function (p) {
          p.name = 'Fritz';
          return p.save()
            .then(function () {
              return Person.findOne()
                .then(function (p) {
                  p.name.should.equal('Fritz');
                  done();
                });
            });
        })
        .catch(done);
    });

    it('should save invalid object (skipping validation)', function (done) {
      Person.findOne(function (err, p) {
        should.not.exist(err);
        p.isValid = function (done) {
          process.nextTick(done);
          return false;
        };
        p.name = 'Nana';
        p.save(function (err) {
          should.exist(err);
          p.save({validate: false}, function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should save invalid object (skipping validation - promise variant)', function (done) {
      Person.findOne()
        .then(function (p) {
          p.isValid = function (done) {
            process.nextTick(done);
            return false;
          };
          p.name = 'Nana';
          return p.save()
            .then(function (d) {
              done(new Error('save should have failed.'));
            }, function (err) {
              should.exist(err);
              p.save({validate: false})
                .then(function (d) {
                  should.exist(d);
                  done();
                });
            });
        })
        .catch(done);
    });

    it('should save throw error on validation', function () {
      Person.findOne(function (err, p) {
        should.not.exist(err);
        p.isValid = function (cb) {
          cb(false);
          return false;
        };
        (function () {
          p.save({
            'throws': true
          });
        }).should.throw(ValidationError);
      });
    });

    it('should preserve properties with dynamic setters', function(done) {
      // This test reproduces a problem discovered by LoopBack unit-test
      // "User.hasPassword() should match a password after it is changed"
      StubUser.create({ password: 'foo' }, function(err, created) {
        if (err) return done(err);
        created.password = 'bar';
        created.save(function(err, saved) {
          if (err) return done(err);
          saved.password.should.equal('bar-BAR');
          StubUser.findById(created.id, function(err, found) {
            if (err) return done(err);
            found.password.should.equal('bar-BAR');
            done();
          });
        });
      });
    });
  });

  describe('updateAttributes', function () {
    var person;

    before(function (done) {
      Person.destroyAll(function () {
        Person.create({name: 'Mary', age: 15}, function(err, p) {
          if (err) return done(err);
          person = p;
          done();
        });
      });
    });

    it('should update one attribute', function (done) {
      person.updateAttribute('name', 'Paul Graham', function (err, p) {
        if (err) return done(err);
        Person.all(function (e, ps) {
          if (e) return done(e);
          ps.should.have.lengthOf(1);
          ps.pop().name.should.equal('Paul Graham');
          done();
        });
      });
    });

    it('should update one attribute (promise variant)', function (done) {
      person.updateAttribute('name', 'Teddy Graham')
      .then(function (p) {
        return Person.all()
        .then(function (ps) {
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

    it('should ignore unknown attributes when strict: true', function(done) {
      person.updateAttributes({foo:'bar'},
        function(err, p) {
          if (err) return done(err);
          should.not.exist(p.foo);
          Person.findById(p.id, function(e, p) {
            if (e) return done(e);
            should.not.exist(p.foo);
            done();
          });
        });
    });

    it('should throw error on unknown attributes when strict: throw', function(done) {
      Person.definition.settings.strict = 'throw';
      Person.findById(person.id, function(err, p) {
        p.updateAttributes({foo:'bar'},
          function(err, p) {
            should.exist(err);
            err.name.should.equal('Error');
            err.message.should.equal('Unknown property: foo');
            should.not.exist(p);
            Person.findById(person.id, function(e, p) {
              if (e) return done(e);
              should.not.exist(p.foo);
              done();
            });
          });
      });
    });

    it('should throw error on unknown attributes when strict: throw', function(done) {
      Person.definition.settings.strict = 'validate';
      Person.findById(person.id, function(err, p) {
        p.updateAttributes({foo:'bar'},
          function(err, p) {
            should.exist(err);
            err.name.should.equal('ValidationError');
            err.message.should.containEql('`foo` is not defined in the model');
            Person.findById(person.id, function(e, p) {
              if (e) return done(e);
              should.not.exist(p.foo);
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

  });

  describe('updateOrCreate', function() {
    it('should preserve properties with dynamic setters on create', function(done) {
      StubUser.updateOrCreate({ password: 'foo' }, function(err, created) {
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
      StubUser.create({ password: 'foo' }, function(err, created) {
        if (err) return done(err);
        var data = { id: created.id, password: 'bar' };
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
        { name: 'a-name', gender: undefined },
        function(err, instance) {
          if (err) return done(err);
          instance.toObject().should.have.properties({
            id: instance.id,
            name: 'a-name',
            gender: undefined
          });

          Person.updateOrCreate(
            { id: instance.id, name: 'updated name' },
            function(err, updated) {
              if (err) return done(err);
              var result = updated.toObject();
              result.should.have.properties({
                id: instance.id,
                name: 'updated name'
              });
              should.equal(result.gender, null);
              done();
            });
        });
    });

    it('should allow save() of the created instance', function(done) {
      Person.updateOrCreate(
        { id: 999 /* a new id */, name: 'a-name' },
        function(err, inst) {
          if (err) return done(err);
          inst.save(done);
        });
    });
  });

  describe('findOrCreate', function() {
    it('should create a record with if new', function(done) {
      Person.findOrCreate({ name: 'Zed', gender: 'male' },
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
      Person.findOrCreate({ name: 'Jed', gender: 'male' })
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

  describe('destroy', function () {

    it('should destroy record', function (done) {
      Person.create(function (err, p) {
        p.destroy(function (err) {
          should.not.exist(err);
          Person.exists(p.id, function (err, ex) {
            ex.should.not.be.ok;
            done();
          });
        });
      });
    });

    it('should destroy record (promise variant)', function (done) {
      Person.create()
        .then(function (p) {
          return p.destroy()
            .then(function () {
              return Person.exists(p.id)
                .then(function (ex) {
                  ex.should.not.be.ok;
                  done();
                });
            });
        })
        .catch(done);
    });

    it('should destroy all records', function (done) {
      Person.destroyAll(function (err) {
        should.not.exist(err);
        Person.all(function (err, posts) {
          posts.should.have.lengthOf(0);
          Person.count(function (err, count) {
            count.should.eql(0);
            done();
          });
        });
      });
    });

    it('should destroy all records (promise variant)', function (done) {
      Person.create()
        .then(function() {
          return Person.destroyAll()
            .then(function () {
              return Person.all()
                .then(function (ps) {
                  ps.should.have.lengthOf(0);
                  return Person.count()
                    .then(function (count) {
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

  describe('deleteAll/destroyAll', function () {
    beforeEach(function clearOldData(done) {
      Person.deleteAll(done);
    });

    beforeEach(function createTestData(done) {
      Person.create([{
        name: 'John'
      }, {
        name: 'Jane'
      }], done);
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
      Person.deleteAll(function (err, info) {
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

  describe('deleteById', function() {
    beforeEach(givenSomePeople);
    afterEach(function() {
      Person.settings.strictDelete = false;
    });

    it('should allow deleteById(id) - success', function (done) {
      Person.findOne(function (e, p) {
        Person.deleteById(p.id, function(err, info) {
          if (err) return done(err);
          info.should.have.property('count', 1);
          done();
        });
      });
    });

    it('should allow deleteById(id) - fail', function (done) {
      Person.settings.strictDelete = false;
      Person.deleteById(9999, function(err, info) {
        if (err) return done(err);
        info.should.have.property('count', 0);
        done();
      });
    });

    it('should allow deleteById(id) - fail with error', function (done) {
      Person.settings.strictDelete = true;
      Person.deleteById(9999, function(err) {
        should.exist(err);
        err.message.should.equal('No instance with id 9999 found for Person');
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

    it('should allow delete(id) - success', function (done) {
      Person.findOne(function (e, p) {
        p.delete(function(err, info) {
          if (err) return done(err);
          info.should.have.property('count', 1);
          done();
        });
      });
    });

    it('should allow delete(id) - fail', function (done) {
      Person.settings.strictDelete = false;
      Person.findOne(function (e, p) {
        p.delete(function(err, info) {
          if (err) return done(err);
          info.should.have.property('count', 1);
          p.delete(function(err, info) {
            if (err) return done(err);
            info.should.have.property('count', 0);
            done();
          });
        });
      });
    });

    it('should allow delete(id) - fail with error', function (done) {
      Person.settings.strictDelete = true;
      Person.findOne(function (e, u) {
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

  describe('initialize', function () {
    it('should initialize object properly', function () {
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
          createdAt: { type: Date, default: '$now' }
        });
        db.automigrate('CustomModel1', done);
      });

      it('should report current date as default value for date property',
        function(done) {
          var now = Date.now();

          var myCustomModel = CustomModel.create(function(err, m) {
            should.not.exists(err);
            m.createdAt.should.be.instanceOf(Date);
            (m.createdAt >= now).should.be.true;
          });

          done();
        });
    });

    describe('Date $now function', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel2', {
          now: { type: String, default: '$now' }
        });
        db.automigrate('CustomModel2', done);
      });

      it('should report \'$now\' as default value for string property',
        function(done) {
          var myCustomModel = CustomModel.create(function(err, m) {
            should.not.exists(err);
            m.now.should.be.instanceOf(String);
            m.now.should.equal('$now');
          });

          done();
        });
    });

    describe('now defaultFn', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel3', {
          now: { type: Date, defaultFn: 'now' }
        });
        db.automigrate('CustomModel3', done);
      });

      it('should generate current time when "defaultFn" is "now"',
        function(done) {
          var now = Date.now();
          var inst = CustomModel.create(function(err, m) {
            should.not.exists(err);
            m.now.should.be.instanceOf(Date);
            m.now.should.be.within(now, now + 200);
            done();
          });
        });
    });

    describe('guid defaultFn', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel4', {
          guid: { type: String, defaultFn: 'guid' }
        });
        db.automigrate('CustomModel4', done);
      });

      it('should generate a new id when "defaultFn" is "guid"', function(done) {
        var inst = CustomModel.create(function(err, m) {
          should.not.exists(err);
          m.guid.should.match(UUID_REGEXP);
          done();
        });
      });
    });

    describe('uuid defaultFn', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel5', {
          guid: { type: String, defaultFn: 'uuid' }
        });
        db.automigrate('CustomModel5', done);
      });

      it('should generate a new id when "defaultfn" is "uuid"', function(done) {
        var inst = CustomModel.create(function(err, m) {
          should.not.exists(err);
          m.guid.should.match(UUID_REGEXP);
          done();
        });
      });
    });


    describe('uuidv4 defaultFn', function() {
      var CustomModel;

      before(function(done) {
        CustomModel = db.define('CustomModel5', {
          guid: { type: String, defaultFn: 'uuidv4' }
        });
        db.automigrate('CustomModel5', done);
      });

      it('should generate a new id when "defaultfn" is "uuidv4"', function(done) {
        var inst = CustomModel.create(function(err, m) {
          should.not.exists(err);
          m.guid.should.match(UUID_REGEXP);
          done();
        });
      });
    });

    // it('should work when constructor called as function', function() {
    //     var p = Person({name: 'John Resig'});
    //     p.should.be.an.instanceOf(Person);
    //     p.name.should.equal('John Resig');
    // });
  });

  describe('property value coercion', function () {
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

    it('should coerce boolean types properly', function() {
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

      try {
        p1 = new Person({name: 'John', dob: 'X'});
        throw new Error('new Person() should have thrown');
      } catch (e) {
        e.should.be.eql(new Error('Invalid date: X'));
      }
    });
  });

  describe('update/updateAll', function() {
    beforeEach(function clearOldData(done) {
      Person.destroyAll(done);
    });

    beforeEach(function createTestData(done) {
      Person.create([{
        name: 'Brett Boe',
        age: 19
      }, {
        name: 'Carla Coe',
        age: 20
      }, {
        name: 'Donna Doe',
        age: 21
      }, {
        name: 'Frank Foe',
        age: 22
      }, {
        name: 'Grace Goe',
        age: 23
      }], done);
    });

    it('should be defined as a function', function() {
      Person.update.should.be.a.Function;
      Person.updateAll.should.be.a.Function;
    });

    it('should not update instances that do not satisfy the where condition',
        function(done) {
      Person.update({name: 'Harry Hoe'}, {name: 'Marta Moe'}, function(err,
          info) {
        if (err) return done(err);
        info.should.have.property('count', 0);
        Person.find({where: {name: 'Harry Hoe'}}, function(err, people) {
          if (err) return done(err);
          people.should.be.empty;
          done();
        });
      });
    });

    it('should only update instances that satisfy the where condition',
        function(done) {
      Person.update({name: 'Brett Boe'}, {name: 'Harry Hoe'}, function(err,
          info) {
        if (err) return done(err);
        info.should.have.property('count', 1);
        Person.find({where: {age: 19}}, function(err, people) {
          if (err) return done(err);
          people.should.have.length(1);
          people[0].name.should.equal('Harry Hoe');
          done();
        });
      });
    });

    it('should update all instances when the where condition is not provided',
        function(done) {
      Person.update({name: 'Harry Hoe'}, function(err, info) {
        if (err) return done(err);
        info.should.have.property('count', 5);
        Person.find({where: {name: 'Brett Boe'}}, function(err, people) {
          if (err) return done(err);
          people.should.be.empty;
          Person.find({where: {name: 'Harry Hoe'}}, function(err, people) {
            if (err) return done(err);
            people.should.have.length(5);
            done();
          });
        });
      });
    });

    it('should ignore where conditions with undefined values',
        function(done) {
      Person.update({name: 'Brett Boe'}, {name: undefined, gender: 'male'},
          function(err, info) {
        if (err) return done(err);
        info.should.have.property('count', 1);
        Person.find({where: {name: 'Brett Boe'}}, function(err, people) {
          if (err) return done(err);
          people.should.have.length(1);
          people[0].name.should.equal('Brett Boe');
          done();
        });
      });
    });

    it('should not coerce invalid values provided in where conditions',
        function(done) {
      Person.update({name: 'Brett Boe'}, {dob: 'Carla Coe'}, function(err) {
        should.exist(err);
        err.message.should.equal('Invalid date: Carla Coe');
        done();
      });
    });
  });
});

function givenSomePeople(done) {
  var beatles = [
    { name: 'John Lennon', gender: 'male' },
    { name: 'Paul McCartney', gender: 'male' },
    { name: 'George Harrison', gender: 'male' },
    { name: 'Ringo Starr', gender: 'male' },
    { name: 'Pete Best', gender: 'male' },
    { name: 'Stuart Sutcliffe', gender: 'male' }
  ];

  async.series([
    Person.destroyAll.bind(Person),
    function(cb) {
      async.each(beatles, Person.create.bind(Person), cb);
    }
  ], done);
}
