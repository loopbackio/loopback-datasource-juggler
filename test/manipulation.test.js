// This test written in mocha+should.js
var should = require('./init.js');

var db, Person;
var ValidationError = require('..').ValidationError;

describe('manipulation', function () {

  before(function (done) {
    db = getSchema();

    Person = db.define('Person', {
      name: String,
      gender: String,
      married: Boolean,
      age: {type: Number, index: true},
      dob: Date,
      createdAt: {type: Number, default: Date.now}
    }, { forceId: true });

    db.automigrate(done);

  });

  // A simplified implementation of LoopBack's User model
  // to reproduce problems related to properties with dynamic setters
  // For the purpose of the tests, we use a counter instead of a hash fn.
  var StubUser, stubPasswordCounter;
  before(function setupStubUserModel(done) {
    StubUser = db.createModel('StubUser', { password: String }, { forceId: true });
    StubUser.setter.password = function(plain) {
      this.$password = plain + '-' + (++stubPasswordCounter);
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
        Person.findById(p.id)
        .then (function (person) {
          person.id.should.eql(p.id);
          person.name.should.equal('Anatoliy');
          done();
        });
      }, function (err) {
        should.not.exist(err);
        done();
      });
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
      }, function (err) {
        should.not.exist(err);
        done();
      });

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
        should.not.exist(p);
        done();
      }, function (err) {
        err.should.be.instanceof(ValidationError);
        err.statusCode.should.equal(422);
        err.details.messages.id.should.eql(['can\'t be set']);
        done();
      });
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
        should.not.exist(inst);
        done();
      }, function (err) {
        err.should.be.instanceof(ValidationError);
        err.statusCode.should.equal(422);
        err.details.messages.id.should.eql(['can\'t be set']);
        done();
      });
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
        Person.findById(p.id)
        .then (function (person) {
          person.id.should.eql(p.id);
          should.not.exists(person.name);
          done();
        });
      }, function (err) {
        should.not.exist(err);
        done();
      });
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

    it('should create batch of objects (promise variant)', function (done) {
      var batch = [
        {name: 'Shaltay'},
        {name: 'Boltay'},
        {}
      ];

      Person.create(batch)
      .then (function (ps) {
        should.exist(ps);
        ps.should.be.instanceOf(Array);
        ps.should.have.lengthOf(batch.length);

        Person.validatesPresenceOf('name');
        Person.create(batch)
        .then (function (persons) {
          should.exist(persons);
          persons.should.have.lengthOf(batch.length);
          persons[0].errors.should.be.false
          persons[1].errors.should.be.false
          persons[2].errors.name.should.be.instanceOf(Array);
          persons[2].errors.name[0].should.equal("can't be blank");
          done();
        }, function (err) {
          should.not.exist(err);
          done();
        })
      }, function (e) {
        should.not.exist(e);
        done();
      })
      .finally (function () {
          delete Person.validations;
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

    it('should create batch of objects with beforeCreate (promise variant)', function(done) {
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
      Person.create(batch)
      .then(function(ps) {
        should.exist(ps);
        ps.should.be.instanceOf(Array);
        ps.should.have.lengthOf(batch.length);
        ps[0].should.be.eql({id: 'a', name: 'A'});
        done();
      }, function (e) {
        should.not.exist(e);
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
            found.toObject().should.have.properties({
              id: created.id,
              name: 'a-name',
              gender: undefined
            });
            done();
          });
        });
    });

    it('should preserve properties with "undefined" value (promise variant)', function(done) {
      Person.create({ name: 'a-name', gender: undefined })
      .then(function (created) {
        created.toObject().should.have.properties({
          id: created.id,
          name: 'a-name',
          gender: undefined
        });

        Person.findById(created.id)
        .then(function(found) {
          found.toObject().should.have.properties({
            id: created.id,
            name: 'a-name',
            gender: undefined
          });
          done();
        });
      }, done);

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
      }, done);
    });

    it('should save existing object', function (done) {
      Person.findOne(function (err, p) {
        should.not.exist(err);
        p.name = 'Hans';
        p.save(function (err) {
          should.not.exist(err);
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
        p.save()
        .then(function () {
          Person.findOne()
          .then(function (p) {
            p.name.should.equal('Fritz');
            done();
          });
        });
      }, done);
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
        p.save()
        .then(function (d) {
          should.not.exist(d);
          done();
        }, function (err) {
          should.exist(err);
          p.save({validate: false})
          .then(function (d) {
            should.exist(d);
            done();
          }, function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
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
          saved.password.should.equal('bar-2');
          StubUser.findById(created.id, function(err, found) {
            if (err) return done(err);
            found.password.should.equal('bar-2');
            done();
          });
        });
      });
    });

    it('should preserve properties with dynamic setters (promise variant)', function(done) {
      // This test reproduces a problem discovered by LoopBack unit-test
      // "User.hasPassword() should match a password after it is changed"
      StubUser.create({ password: 'foo' })
      .then(function(created) {
        created.password = 'bar';
        created.save()
        .then(function(saved) {
          saved.password.should.equal('bar-2');
          StubUser.findById(created.id)
          .then(function(found) {
            found.password.should.equal('bar-2');
            done();
          }, done);
        }, done);
      }, done);
    });
  });

  describe('updateAttributes', function () {
    var person;

    before(function (done) {
      Person.destroyAll(function () {
        person = Person.create({name: 'Mary', age: 15}, done);
      });
    });

    it('should update one attribute', function (done) {
      person.updateAttribute('name', 'Paul Graham', function (err, p) {
        should.not.exist(err);
        Person.all(function (e, ps) {
          should.not.exist(e);
          ps.should.have.lengthOf(1);
          ps.pop().name.should.equal('Paul Graham');
          done();
        });
      });
    });

    it('should update one attribute (promise variant)', function (done) {
      person.updateAttribute('name', 'Teddy Graham')
      .then(function (p) {
        Person.all()
        .then(function (ps) {
          ps.should.have.lengthOf(1);
          ps.pop().name.should.equal('Teddy Graham');
          done();
        }, done);
      }, done);
    });

    it('should ignore undefined values on updateAttributes', function(done) {
      person.updateAttributes({'name': 'John', age: undefined},
        function(err, p) {
          should.not.exist(err);
          Person.findById(p.id, function(e, p) {
            should.not.exist(e);
            p.name.should.equal('John');
            p.age.should.equal(15);
            done();
          });
        });
    });

    it('should ignore undefined values on updateAttributes (promise variant)', function(done) {
      person.updateAttributes({'name': 'John', age: undefined})
      .then(function(p) {
        Person.findById(p.id)
        .then(function(p) {
          p.name.should.equal('John');
          p.age.should.equal(15);
          done();
        }, done);
      }, done);
    });

    it('should allows model instance on updateAttributes', function(done) {
      person.updateAttributes(new Person({'name': 'John', age: undefined}),
        function(err, p) {
          should.not.exist(err);
          Person.findById(p.id, function(e, p) {
            should.not.exist(e);
            p.name.should.equal('John');
            p.age.should.equal(15);
            done();
          });
        });
    });

    it('should allows model instance on updateAttributes (promise variant)', function(done) {
      person.updateAttributes(new Person({'name': 'Jane', age: undefined}))
      .then(function(p) {
        Person.findById(p.id)
        .then(function(p) {
          p.name.should.equal('Jane');
          p.age.should.equal(15);
          done();
        });
      }, done);
    });

  });

  describe('updateOrCreate', function() {
    it('should preserve properties with dynamic setters on create', function(done) {
      StubUser.updateOrCreate({ id: 'newid', password: 'foo' }, function(err, created) {
        if (err) return done(err);
        created.password.should.equal('foo-1');
        StubUser.findById(created.id, function(err, found) {
          if (err) return done(err);
          found.password.should.equal('foo-1');
          done();
        });
      });
    });

    it('should preserve properties with dynamic setters on create (promise variant)', function(done) {
      StubUser.updateOrCreate({ id: 'newid', password: 'foo' })
      .then(function(created) {
        created.password.should.equal('foo-1');
        StubUser.findById(created.id)
        .then(function(found) {
          found.password.should.equal('foo-1');
          done();
        });
      }, done);
    });

    it('should preserve properties with dynamic setters on update', function(done) {
      StubUser.create({ password: 'foo' }, function(err, created) {
        if (err) return done(err);
        var data = { id: created.id, password: 'bar' };
        StubUser.updateOrCreate(data, function(err, updated) {
          if (err) return done(err);
          updated.password.should.equal('bar-2');
          StubUser.findById(created.id, function(err, found) {
            if (err) return done(err);
            found.password.should.equal('bar-2');
            done();
          });
        });
      });
    });

    it('should preserve properties with dynamic setters on update (promise variant)', function(done) {
      StubUser.create({ password: 'foo' })
      .then(function(created) {
        var data = { id: created.id, password: 'bar' };
        StubUser.updateOrCreate(data)
        .then(function(updated) {
          updated.password.should.equal('bar-2');
          StubUser.findById(created.id)
          .then(function(found) {
            found.password.should.equal('bar-2');
            done();
          });
        });
      }, done);
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
              updated.toObject().should.have.properties({
                id: instance.id,
                name: 'updated name',
                gender: undefined
              });
              done();
            });
        });
    });

    it('should preserve properties with "undefined" value (promise variant)', function(done) {
      Person.create({ name: 'b-name', gender: undefined })
      .then(function(instance) {
        instance.toObject().should.have.properties({
          id: instance.id,
          name: 'b-name',
          gender: undefined
        });

        Person.updateOrCreate({ id: instance.id, name: 'updated name 2' })
        .then(function(updated) {
          updated.toObject().should.have.properties({
            id: instance.id,
            name: 'updated name 2',
            gender: undefined
          });
          done();
        });
      }, done);
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
        p.destroy()
        .then(function () {
          Person.exists(p.id)
          .then(function (ex) {
            ex.should.not.be.ok;
            done();
          });
        });
      }, done);
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
        Person.destroyAll()
        .then(function () {
          Person.all()
          .then(function (ps) {
            ps.should.have.lengthOf(0);
            Person.count()
            .then(function (count) {
              count.should.eql(0);
              done();
            });
          });
        });
      }, done);

    });

    // TODO: implement destroy with filtered set
    it('should destroy filtered set of records');
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
});
