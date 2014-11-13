// This test written in mocha+should.js
var should = require('./init.js');
var jdb = require('../');
var DataSource = jdb.DataSource;

var db, tmp, Book, Chapter, Author, Reader;
var Category, Job;
var Picture, PictureLink;
var Person, Address;
var Link;

var getTransientDataSource = function(settings) {
    return new DataSource('transient', settings, db.modelBuilder);
};

var getMemoryDataSource = function(settings) {
    return new DataSource('memory', settings, db.modelBuilder);
};

describe('relations', function () {

  describe('hasMany', function () {
    before(function (done) {
      db = getSchema();
      Book = db.define('Book', {name: String, type: String});
      Chapter = db.define('Chapter', {name: {type: String, index: true},
        bookType: String});
      Author = db.define('Author', {name: String});
      Reader = db.define('Reader', {name: String});

      db.automigrate(function () {
        Book.destroyAll(function () {
          Chapter.destroyAll(function () {
            Author.destroyAll(function () {
              Reader.destroyAll(done);
            });
          });
        });
      });
    });

    it('can be declared in different ways', function (done) {
      Book.hasMany(Chapter);
      Book.hasMany(Reader, {as: 'users'});
      Book.hasMany(Author, {foreignKey: 'projectId'});
      var b = new Book;
      b.chapters.should.be.an.instanceOf(Function);
      b.users.should.be.an.instanceOf(Function);
      b.authors.should.be.an.instanceOf(Function);
      Object.keys((new Chapter).toObject()).should.include('bookId');
      Object.keys((new Author).toObject()).should.include('projectId');

      db.automigrate(done);
    });

    it('can be declared in short form', function (done) {
      Author.hasMany('readers');
      (new Author).readers.should.be.an.instanceOf(Function);
      Object.keys((new Reader).toObject()).should.include('authorId');

      db.autoupdate(done);
    });

    describe('with scope', function() {

      before(function (done) {
        Book.hasMany(Chapter);
        done();
      });

      it('should build record on scope', function (done) {
        Book.create(function (err, book) {
          var c = book.chapters.build();
          c.bookId.should.equal(book.id);
          c.save(done);
        });
      });

      it('should create record on scope', function (done) {
        Book.create(function (err, book) {
          book.chapters.create(function (err, c) {
            should.not.exist(err);
            should.exist(c);
            c.bookId.should.equal(book.id);
            done();
          });
        });
      });

      it('should create a batch of records on scope', function (done) {
        var chapters = [
          {name: 'a'},
          {name: 'z'},
          {name: 'c'}
        ];
        Book.create(function (err, book) {
          book.chapters.create(chapters, function (err, chs) {
            should.not.exist(err);
            should.exist(chs);
            chs.should.have.lengthOf(chapters.length);
            chs.forEach(function(c) {
              c.bookId.should.equal(book.id);
            });
            done();
          });
        });
      });

      it('should fetch all scoped instances', function (done) {
        Book.create(function (err, book) {
          book.chapters.create({name: 'a'}, function () {
            book.chapters.create({name: 'z'}, function () {
              book.chapters.create({name: 'c'}, function () {
                verify(book);
              });
            });
          });
        });
        function verify(book) {
          book.chapters(function (err, ch) {
            should.not.exist(err);
            should.exist(ch);
            ch.should.have.lengthOf(3);

            var chapters = book.chapters();
            chapters.should.eql(ch);

            book.chapters({order: 'name DESC'}, function (e, c) {
              should.not.exist(e);
              should.exist(c);

              c.shift().name.should.equal('z');
              c.pop().name.should.equal('a');
              done();
            });
          });
        }
      });

      it('should find scoped record', function (done) {
        var id;
        Book.create(function (err, book) {
          book.chapters.create({name: 'a'}, function (err, ch) {
            id = ch.id;
            book.chapters.create({name: 'z'}, function () {
              book.chapters.create({name: 'c'}, function () {
                verify(book);
              });
            });
          });
        });

        function verify(book) {
          book.chapters.findById(id, function (err, ch) {
            should.not.exist(err);
            should.exist(ch);
            ch.id.should.eql(id);
            done();
          });
        }
      });

      it('should count scoped records - all and filtered', function (done) {
        Book.create(function (err, book) {
          book.chapters.create({name: 'a'}, function (err, ch) {
            book.chapters.create({name: 'b'}, function () {
              book.chapters.create({name: 'c'}, function () {
                verify(book);
              });
            });
          });
        });

        function verify(book) {
          book.chapters.count(function (err, count) {
            should.not.exist(err);
            count.should.equal(3);
            book.chapters.count({ name: 'b' }, function (err, count) {
              should.not.exist(err);
              count.should.equal(1);
              done();
            });
          });
        }
      });

      it('should set targetClass on scope property', function() {
        should.equal(Book.prototype.chapters._targetClass, 'Chapter');
      });

      it('should update scoped record', function (done) {
        var id;
        Book.create(function (err, book) {
          book.chapters.create({name: 'a'}, function (err, ch) {
            id = ch.id;
            book.chapters.updateById(id, {name: 'aa'}, function(err, ch) {
              verify(book);
            });
          });
        });

        function verify(book) {
          book.chapters.findById(id, function (err, ch) {
            should.not.exist(err);
            should.exist(ch);
            ch.id.should.eql(id);
            ch.name.should.equal('aa');
            done();
          });
        }
      });

      it('should destroy scoped record', function (done) {
        var id;
        Book.create(function (err, book) {
          book.chapters.create({name: 'a'}, function (err, ch) {
            id = ch.id;
            book.chapters.destroy(id, function(err, ch) {
              verify(book);
            });
          });
        });

        function verify(book) {
          book.chapters.findById(id, function (err, ch) {
            should.exist(err);
            done();
          });
        }
      });

      it('should check existence of a scoped record', function (done) {
        var id;
        Book.create(function (err, book) {
          book.chapters.create({name: 'a'}, function (err, ch) {
            id = ch.id;
            book.chapters.create({name: 'z'}, function () {
              book.chapters.create({name: 'c'}, function () {
                verify(book);
              });
            });
          });
        });

        function verify(book) {
          book.chapters.exists(id, function (err, flag) {
            should.not.exist(err);
            flag.should.be.eql(true);
            done();
          });
        }
      });

      it('should check ignore related data on creation - array', function (done) {
        Book.create({ chapters: [] }, function (err, book) {
          should.not.exist(err);
          book.chapters.should.be.a.function;
          var obj = book.toObject();
          should.not.exist(obj.chapters);
          done();
        });
      });

      it('should check ignore related data on creation - object', function (done) {
        Book.create({ chapters: {} }, function (err, book) {
          should.not.exist(err);
          book.chapters.should.be.a.function;
          var obj = book.toObject();
          should.not.exist(obj.chapters);
          done();
        });
      });
    });

  });

  describe('hasMany through', function () {
    var Physician, Patient, Appointment, Address;

    before(function (done) {
      db = getSchema();
      Physician = db.define('Physician', {name: String});
      Patient = db.define('Patient', {name: String});
      Appointment = db.define('Appointment', {date: {type: Date,
        default: function () {
          return new Date();
        }}});
      Address = db.define('Address', {name: String});
      
      Physician.hasMany(Patient, {through: Appointment});
      Patient.hasMany(Physician, {through: Appointment});
      Patient.belongsTo(Address);
      Appointment.belongsTo(Patient);
      Appointment.belongsTo(Physician);

      db.automigrate(['Physician', 'Patient', 'Appointment', 'Address'], function (err) {
        done(err);
      });
    });

    it('should build record on scope', function (done) {
      Physician.create(function (err, physician) {
        var patient = physician.patients.build();
        patient.physicianId.should.equal(physician.id);
        patient.save(done);
      });
    });

    it('should create record on scope', function (done) {
      Physician.create(function (err, physician) {
        physician.patients.create(function (err, patient) {
          should.not.exist(err);
          should.exist(patient);
          Appointment.find({where: {physicianId: physician.id, patientId: patient.id}},
            function(err, apps) {
              should.not.exist(err);
              apps.should.have.lengthOf(1);
              done();
          });
        });
      });
    });

    it('should create multiple records on scope', function (done) {
      var async = require('async');
      Physician.create(function (err, physician) {
        physician.patients.create([{}, {}], function (err, patients) {
          should.not.exist(err);
          should.exist(patients);
          patients.should.have.lengthOf(2);
          function verifyPatient(patient, next) {
            Appointment.find({where: {
              physicianId: physician.id,
              patientId: patient.id
            }},
              function(err, apps) {
                should.not.exist(err);
                apps.should.have.lengthOf(1);
                next();
            });
          }
          async.forEach(patients, verifyPatient, done);
        });
      });
    });

    it('should fetch all scoped instances', function (done) {
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function () {
          physician.patients.create({name: 'z'}, function () {
            physician.patients.create({name: 'c'}, function () {
              verify(physician);
            });
          });
        });
      });
      function verify(physician) {
        physician.patients(function (err, ch) {
          
          var patients = physician.patients();
          patients.should.eql(ch);
          
          should.not.exist(err);
          should.exist(ch);
          ch.should.have.lengthOf(3);
          done();
        });
      }
    });

    it('should find scoped record', function (done) {
      var id;
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function (err, ch) {
          id = ch.id;
          physician.patients.create({name: 'z'}, function () {
            physician.patients.create({name: 'c'}, function () {
              verify(physician);
            });
          });
        });
      });

      function verify(physician) {
        physician.patients.findById(id, function (err, ch) {
          should.not.exist(err);
          should.exist(ch);
          ch.id.should.eql(id);
          done();
        });
      }
    });

    it('should allow to use include syntax on related data', function (done) {
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function (err, patient) {
          Address.create({name: 'z'}, function (err, address) {
            should.not.exist(err);
            patient.address(address);
            patient.save(function() {
              verify(physician, address.id);
            });
          });
        });
      });
      function verify(physician, addressId) {
        physician.patients({include: 'address'}, function (err, ch) {
          should.not.exist(err);
          should.exist(ch);
          ch.should.have.lengthOf(1);
          ch[0].addressId.should.eql(addressId);
          var address = ch[0].address();
          should.exist(address);
          address.should.be.an.instanceof(Address);
          address.name.should.equal('z');
          done();
        });
      }
    });

    it('should set targetClass on scope property', function() {
      should.equal(Physician.prototype.patients._targetClass, 'Patient');
    });

    it('should update scoped record', function (done) {
      var id;
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function (err, ch) {
          id = ch.id;
          physician.patients.updateById(id, {name: 'aa'}, function(err, ch) {
            verify(physician);
          });
        });
      });

      function verify(physician) {
        physician.patients.findById(id, function (err, ch) {
          should.not.exist(err);
          should.exist(ch);
          ch.id.should.eql(id);
          ch.name.should.equal('aa');
          done();
        });
      }
    });

    it('should destroy scoped record', function (done) {
      var id;
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function (err, ch) {
          id = ch.id;
          physician.patients.destroy(id, function(err, ch) {
            verify(physician);
          });
        });
      });

      function verify(physician) {
        physician.patients.findById(id, function (err, ch) {
          should.exist(err);
          done();
        });
      }
    });

    it('should check existence of a scoped record', function (done) {
      var id;
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function (err, ch) {
          should.not.exist(err);
          id = ch.id;
          physician.patients.create({name: 'z'}, function () {
            physician.patients.create({name: 'c'}, function () {
              verify(physician);
            });
          });
        });
      });

      function verify(physician) {
        physician.patients.exists(id, function (err, flag) {
          should.not.exist(err);
          flag.should.be.eql(true);
          done();
        });
      }
    });

    it('should allow to add connection with instance', function (done) {
      Physician.create({name: 'ph1'}, function (e, physician) {
        Patient.create({name: 'pa1'}, function (e, patient) {
          physician.patients.add(patient, function (e, app) {
            should.not.exist(e);
            should.exist(app);
            app.should.be.an.instanceOf(Appointment);
            app.physicianId.should.equal(physician.id);
            app.patientId.should.equal(patient.id);
            done();
          });
        });
      });
    });

    it('should allow to add connection with through data', function (done) {
      Physician.create({name: 'ph1'}, function (e, physician) {
        Patient.create({name: 'pa1'}, function (e, patient) {
          var now = Date.now();
          physician.patients.add(patient, { date: new Date(now) }, function (e, app) {
            should.not.exist(e);
            should.exist(app);
            app.should.be.an.instanceOf(Appointment);
            app.physicianId.should.equal(physician.id);
            app.patientId.should.equal(patient.id);
            app.patientId.should.equal(patient.id);
            app.date.getTime().should.equal(now);
            done();
          });
        });
      });
    });

    it('should allow to remove connection with instance', function (done) {
      var id;
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function (err, patient) {
          id = patient.id;
          physician.patients.remove(id, function (err, ch) {
            verify(physician);
          });
        });
      });

      function verify(physician) {
        physician.patients.exists(id, function (err, flag) {
          should.not.exist(err);
          flag.should.be.eql(false);
          done();
        });
      }
    });

    beforeEach(function (done) {
      Appointment.destroyAll(function (err) {
        Physician.destroyAll(function (err) {
          Patient.destroyAll(done);
        });
      });
    });

  });

  describe('hasMany through - collect', function () {
    var Physician, Patient, Appointment, Address;

    beforeEach(function (done) {
      db = getSchema();
      Physician = db.define('Physician', {name: String});
      Patient = db.define('Patient', {name: String});
      Appointment = db.define('Appointment', {date: {type: Date,
        default: function () {
          return new Date();
        }}});
      Address = db.define('Address', {name: String});

      db.automigrate(['Physician', 'Patient', 'Appointment', 'Address'], function (err) {
        done(err);
      });
    });

    describe('with default options', function () {
      it('can determine the collect by modelTo\'s name as default', function () {
        Physician.hasMany(Patient, {through: Appointment});
        Patient.hasMany(Physician, {through: Appointment, as: 'yyy'});
        Patient.belongsTo(Address);
        Appointment.belongsTo(Physician);
        Appointment.belongsTo(Patient);
        var physician = new Physician({id: 1});
        var scope1 = physician.patients._scope;
        scope1.should.have.property('collect', 'patient');
        scope1.should.have.property('include', 'patient');
        var patient = new Patient({id: 1});
        var scope2 = patient.yyy._scope;
        scope2.should.have.property('collect', 'physician');
        scope2.should.have.property('include', 'physician');
      });
    });

    describe('when custom reverse belongsTo names for both sides', function () {
      it('can determine the collect via keyThrough', function () {
        Physician.hasMany(Patient, {through: Appointment, foreignKey: 'fooId', keyThrough: 'barId'});
        Patient.hasMany(Physician, {through: Appointment, foreignKey: 'barId', keyThrough: 'fooId', as: 'yyy'});
        Appointment.belongsTo(Physician, {as: 'foo'});
        Appointment.belongsTo(Patient, {as: 'bar'});
        Patient.belongsTo(Address); // jam.
        Appointment.belongsTo(Patient, {as: 'car'}); // jam. Should we complain in this case???

        var physician = new Physician({id: 1});
        var scope1 = physician.patients._scope;
        scope1.should.have.property('collect', 'bar');
        scope1.should.have.property('include', 'bar');
        var patient = new Patient({id: 1});
        var scope2 = patient.yyy._scope;
        scope2.should.have.property('collect', 'foo');
        scope2.should.have.property('include', 'foo');
      });

      it('can determine the collect via modelTo name', function () {
        Physician.hasMany(Patient, {through: Appointment});
        Patient.hasMany(Physician, {through: Appointment, as: 'yyy'});
        Appointment.belongsTo(Physician, {as: 'foo', foreignKey: 'physicianId'});
        Appointment.belongsTo(Patient, {as: 'bar', foreignKey: 'patientId'});
        Patient.belongsTo(Address); // jam.

        var physician = new Physician({id: 1});
        var scope1 = physician.patients._scope;
        scope1.should.have.property('collect', 'bar');
        scope1.should.have.property('include', 'bar');
        var patient = new Patient({id: 1});
        var scope2 = patient.yyy._scope;
        scope2.should.have.property('collect', 'foo');
        scope2.should.have.property('include', 'foo');
      });

      it('can determine the collect via modelTo name (with jams)', function () {
        Physician.hasMany(Patient, {through: Appointment});
        Patient.hasMany(Physician, {through: Appointment, as: 'yyy'});
        Appointment.belongsTo(Physician, {as: 'foo', foreignKey: 'physicianId'});
        Appointment.belongsTo(Patient, {as: 'bar', foreignKey: 'patientId'});
        Patient.belongsTo(Address); // jam.
        Appointment.belongsTo(Physician, {as: 'goo', foreignKey: 'physicianId'}); // jam. Should we complain in this case???
        Appointment.belongsTo(Patient, {as: 'car', foreignKey: 'patientId'}); // jam. Should we complain in this case???

        var physician = new Physician({id: 1});
        var scope1 = physician.patients._scope;
        scope1.should.have.property('collect', 'bar');
        scope1.should.have.property('include', 'bar');
        var patient = new Patient({id: 1});
        var scope2 = patient.yyy._scope;
        scope2.should.have.property('collect', 'foo'); // first matched relation
        scope2.should.have.property('include', 'foo'); // first matched relation
      });
    });

    describe('when custom reverse belongsTo name for one side only', function () {

      beforeEach(function () {
        Physician.hasMany(Patient, {as: 'xxx', through: Appointment, foreignKey: 'fooId'});
        Patient.hasMany(Physician, {as: 'yyy', through: Appointment, keyThrough: 'fooId'});
        Appointment.belongsTo(Physician, {as: 'foo'});
        Appointment.belongsTo(Patient);
        Patient.belongsTo(Address); // jam.
        Appointment.belongsTo(Physician, {as: 'bar'}); // jam. Should we complain in this case???
      });

      it('can determine the collect via model name', function () {
        var physician = new Physician({id: 1});
        var scope1 = physician.xxx._scope;
        scope1.should.have.property('collect', 'patient');
        scope1.should.have.property('include', 'patient');
      });

      it('can determine the collect via keyThrough', function () {
        var patient = new Patient({id: 1});
        var scope2 = patient.yyy._scope;
        scope2.should.have.property('collect', 'foo');
        scope2.should.have.property('include', 'foo');
      });
    });
  });

  describe('hasMany through - between same model', function () {
    var User, Follow, Address;

    before(function (done) {
      db = getSchema();
      User = db.define('User', {name: String});
      Follow = db.define('Follow', {date: {type: Date,
        default: function () {
          return new Date();
        }}});
      Address = db.define('Address', {name: String});

      User.hasMany(User, {as: 'followers', foreignKey: 'followeeId', keyThrough: 'followerId', through: Follow});
      User.hasMany(User, {as: 'following', foreignKey: 'followerId', keyThrough: 'followeeId', through: Follow});
      User.belongsTo(Address);
      Follow.belongsTo(User, {as: 'follower'});
      Follow.belongsTo(User, {as: 'followee'});
      db.automigrate(['User', 'Follow', 'Address'], function (err) {
        done(err);
      });
    });

    it('can determine the collect via keyThrough for each side', function () {
      var user = new User({id: 1});
      var scope1 = user.followers._scope;
      scope1.should.have.property('collect', 'follower');
      scope1.should.have.property('include', 'follower');
      var scope2 = user.following._scope;
      scope2.should.have.property('collect', 'followee');
      scope2.should.have.property('include', 'followee');
    });
  });

  describe('hasMany with properties', function () {
    it('can be declared with properties', function (done) {
      Book.hasMany(Chapter, { properties: { type: 'bookType' } });
      db.automigrate(done);
    });
    
    it('should create record on scope', function (done) {
      Book.create({ type: 'fiction' }, function (err, book) {
        book.chapters.create(function (err, c) {
          should.not.exist(err);
          should.exist(c);
          c.bookId.should.equal(book.id);
          c.bookType.should.equal('fiction');
          done();
        });
      });
    });
  });

  describe('hasMany with scope and properties', function () {
    it('can be declared with properties', function (done) {
      db = getSchema();
      Category = db.define('Category', {name: String, jobType: String});
      Job = db.define('Job', {name: String, type: String});

      Category.hasMany(Job, {
        properties: function(inst) {
          if (!inst.jobType) return; // skip
          return { type: inst.jobType };
        },
        scope: function(inst, filter) {
          var m = this.properties(inst); // re-use properties
          if (m) return { where: m };
        }
      });
      db.automigrate(done);
    });
    
    it('should create record on scope', function (done) {
      Category.create(function (err, c) {
        c.jobs.create({ type: 'book' }, function(err, p) {
          p.categoryId.should.equal(c.id);
          p.type.should.equal('book');
          c.jobs.create({ type: 'widget' }, function(err, p) {
            p.categoryId.should.equal(c.id);
            p.type.should.equal('widget');
            done();
          });
        });
      });
    });
    
    it('should find records on scope', function (done) {
      Category.findOne(function (err, c) {
        c.jobs(function(err, jobs) {
          jobs.should.have.length(2);
          done();
        });
      });
    });
    
    it('should find record on scope - filtered', function (done) {
      Category.findOne(function (err, c) {
        c.jobs({ where: { type: 'book' } }, function(err, jobs) {
          jobs.should.have.length(1);
          jobs[0].type.should.equal('book');
          done();
        });
      });
    });
    
    // So why not just do the above? In LoopBack, the context
    // that gets passed into a beforeRemote handler contains
    // a reference to the parent scope/instance: ctx.instance
    // in order to enforce a (dynamic scope) at runtime
    // a temporary property can be set in the beforeRemoting
    // handler. Optionally,properties dynamic properties can be declared.
    //
    // The code below simulates this.
    
    it('should create record on scope - properties', function (done) {
      Category.findOne(function (err, c) {
        c.jobType = 'tool'; // temporary
        c.jobs.create(function(err, p) {
          p.categoryId.should.equal(c.id);
          p.type.should.equal('tool');
          done();
        });
      });
    });
    
    it('should find records on scope', function (done) {
      Category.findOne(function (err, c) {
        c.jobs(function(err, jobs) {
          jobs.should.have.length(3);
          done();
        });
      });
    });
    
    it('should find record on scope - scoped', function (done) {
      Category.findOne(function (err, c) {
        c.jobType = 'book'; // temporary, for scoping
        c.jobs(function(err, jobs) {
          jobs.should.have.length(1);
          jobs[0].type.should.equal('book');
          done();
        });
      });
    });
    
    it('should find record on scope - scoped', function (done) {
      Category.findOne(function (err, c) {
        c.jobType = 'tool'; // temporary, for scoping
        c.jobs(function(err, jobs) {
          jobs.should.have.length(1);
          jobs[0].type.should.equal('tool');
          done();
        });
      });
    });

    it('should find count of records on scope - scoped', function (done) {
      Category.findOne(function (err, c) {
        c.jobType = 'tool'; // temporary, for scoping
        c.jobs.count(function(err, count) {
          count.should.equal(1);
          done();
        });
      });
    });
    
    it('should delete records on scope - scoped', function (done) {
      Category.findOne(function (err, c) {
        c.jobType = 'tool'; // temporary, for scoping
        c.jobs.destroyAll(function(err, result) {
          done();
        });
      });
    });
    
    it('should find record on scope - verify', function (done) {
      Category.findOne(function (err, c) {
        c.jobs(function(err, jobs) {
          jobs.should.have.length(2);
          done();
        });
      });
    });
  
  });
  
  describe('polymorphic hasOne', function () {
    before(function (done) {
      db = getSchema();
      Picture = db.define('Picture', {name: String});
      Author = db.define('Author', {name: String});
      Reader = db.define('Reader', {name: String});

      db.automigrate(function () {
        Picture.destroyAll(function () {
          Author.destroyAll(function () {
            Reader.destroyAll(done);
          });
        });
      });
    });

    it('can be declared', function (done) {
      Author.hasOne(Picture, { as: 'avatar', polymorphic: 'imageable' });
      Reader.hasOne(Picture, { as: 'mugshot', polymorphic: 'imageable' });
      Picture.belongsTo('imageable', { polymorphic: true });
      db.automigrate(done);
    });
    
    it('should create polymorphic relation - author', function (done) {
      Author.create({name: 'Author 1' }, function (err, author) {
        author.avatar.create({ name: 'Avatar' }, function (err, p) {
          should.not.exist(err);
          should.exist(p);
          p.imageableId.should.equal(author.id);
          p.imageableType.should.equal('Author');
          done();
        });
      });
    });
    
    it('should create polymorphic relation - reader', function (done) {
      Reader.create({name: 'Reader 1' }, function (err, reader) {
        reader.mugshot.create({ name: 'Mugshot' }, function (err, p) {
          should.not.exist(err);
          should.exist(p);
          p.imageableId.should.equal(reader.id);
          p.imageableType.should.equal('Reader');
          done();
        });
      });
    });
    
    it('should find polymorphic relation - author', function (done) {
      Author.findOne(function (err, author) {
        author.avatar(function (err, p) {
          should.not.exist(err);
          
          var avatar = author.avatar();
          avatar.should.equal(p);
          
          p.name.should.equal('Avatar');
          p.imageableId.should.eql(author.id);
          p.imageableType.should.equal('Author');
          done();
        });
      });
    });
    
    it('should find polymorphic relation - reader', function (done) {
      Reader.findOne(function (err, reader) {
        reader.mugshot(function (err, p) {
          should.not.exist(err);
          p.name.should.equal('Mugshot');
          p.imageableId.should.eql(reader.id);
          p.imageableType.should.equal('Reader');
          done();
        });
      });
    });
    
    it('should find inverse polymorphic relation - author', function (done) {
      Picture.findOne({ where: { name: 'Avatar' } }, function (err, p) {
        p.imageable(function (err, imageable) {
          should.not.exist(err);
          imageable.should.be.instanceof(Author);
          imageable.name.should.equal('Author 1');
          done();
        });
      });
    });
    
    it('should find inverse polymorphic relation - reader', function (done) {
      Picture.findOne({ where: { name: 'Mugshot' } }, function (err, p) {
        p.imageable(function (err, imageable) {
          should.not.exist(err);
          imageable.should.be.instanceof(Reader);
          imageable.name.should.equal('Reader 1');
          done();
        });
      });
    });
    
  });
  
  describe('polymorphic hasOne with non standard ids', function () {
    before(function (done) {
      db = getSchema();
      Picture = db.define('Picture', {name: String});
      Author = db.define('Author', {
        username: {type: String, id: true},
        name: String
      });
      Reader = db.define('Reader', {
        username: {type: String, id: true},
        name: String
      });
      
      db.automigrate(function () {
        Picture.destroyAll(function () {
          Author.destroyAll(function () {
            Reader.destroyAll(done);
          });
        });
      });
    });
    
    it('can be declared with non standard foreign key', function (done) {
      Author.hasOne(Picture, {
        as: 'avatar',
        polymorphic: {
          foreignKey: 'oid',
          discriminator: 'type'
        }
      });
      Reader.hasOne(Picture, {
        as: 'mugshot',
        polymorphic: {
          foreignKey: 'oid',
          discriminator: 'type'
        }
      });
      Picture.belongsTo('owner', {
        idName: 'username',
        polymorphic: {
          idType: String,
          foreignKey: 'oid',
          discriminator: 'type'
        }
      });
      db.automigrate(done);
    });
    
    it('should create polymorphic relation - author', function (done) {
      Author.create({name: 'Author 1' }, function (err, author) {
        author.avatar.create({ name: 'Avatar' }, function (err, p) {
          should.not.exist(err);
          should.exist(p);
          p.oid.should.equal(author.username);
          p.type.should.equal('Author');
          done();
        });
      });
    });
    
    it('should create polymorphic relation - reader', function (done) {
      Reader.create({name: 'Reader 1' }, function (err, reader) {
        reader.mugshot.create({ name: 'Mugshot' }, function (err, p) {
          should.not.exist(err);
          should.exist(p);
          p.oid.should.equal(reader.username);
          p.type.should.equal('Reader');
          done();
        });
      });
    });
    
    it('should find polymorphic relation - author', function (done) {
      Author.findOne(function (err, author) {
        author.avatar(function (err, p) {
          should.not.exist(err);
          
          var avatar = author.avatar();
          avatar.should.equal(p);
          
          p.name.should.equal('Avatar');
          p.oid.should.eql(author.username);
          p.type.should.equal('Author');
          done();
        });
      });
    });
    
    it('should find polymorphic relation - reader', function (done) {
      Reader.findOne(function (err, reader) {
        reader.mugshot(function (err, p) {
          should.not.exist(err);
          p.name.should.equal('Mugshot');
          p.oid.should.eql(reader.username);
          p.type.should.equal('Reader');
          done();
        });
      });
    });
    
    it('should find inverse polymorphic relation - author', function (done) {
      Picture.findOne({ where: { name: 'Avatar' } }, function (err, p) {
        p.owner(function (err, owner) {
          should.not.exist(err);
          owner.should.be.instanceof(Author);
          owner.name.should.equal('Author 1');
          done();
        });
      });
    });
    
    it('should find inverse polymorphic relation - reader', function (done) {
      Picture.findOne({ where: { name: 'Mugshot' } }, function (err, p) {
        p.owner(function (err, owner) {
          should.not.exist(err);
          owner.should.be.instanceof(Reader);
          owner.name.should.equal('Reader 1');
          done();
        });
      });
    });
  
  });
  
  describe('polymorphic hasMany', function () {
    before(function (done) {
      db = getSchema();
      Picture = db.define('Picture', {name: String});
      Author = db.define('Author', {name: String});
      Reader = db.define('Reader', {name: String});

      db.automigrate(function () {
        Picture.destroyAll(function () {
          Author.destroyAll(function () {
            Reader.destroyAll(done);
          });
        });
      });
    });

    it('can be declared', function (done) {
      Author.hasMany(Picture, { polymorphic: 'imageable' });
      Reader.hasMany(Picture, { polymorphic: { // alt syntax
        as: 'imageable', foreignKey: 'imageableId',
        discriminator: 'imageableType'
      } });
      Picture.belongsTo('imageable', { polymorphic: true });
      
      Author.relations['pictures'].toJSON().should.eql({
        name: 'pictures',
        type: 'hasMany',
        modelFrom: 'Author',
        keyFrom: 'id',
        modelTo: 'Picture',
        keyTo: 'imageableId',
        multiple: true,
        polymorphic: { 
          as: 'imageable',
          foreignKey: 'imageableId',
          discriminator: 'imageableType'
        }
      });
      
      Picture.relations['imageable'].toJSON().should.eql({
        name: 'imageable',
        type: 'belongsTo',
        modelFrom: 'Picture',
        keyFrom: 'imageableId',
        modelTo: '<polymorphic>',
        keyTo: 'id',
        multiple: false,
        polymorphic: { 
          as: 'imageable',
          foreignKey: 'imageableId',
          discriminator: 'imageableType'
        }
      });
      
      db.automigrate(done);
    });
    
    it('should create polymorphic relation - author', function (done) {
      Author.create({ name: 'Author 1' }, function (err, author) {
        author.pictures.create({ name: 'Author Pic' }, function (err, p) {
          should.not.exist(err);
          should.exist(p);
          p.imageableId.should.eql(author.id);
          p.imageableType.should.equal('Author');
          done();
        });
      });
    });
    
    it('should create polymorphic relation - reader', function (done) {
      Reader.create({ name: 'Reader 1' }, function (err, reader) {
        reader.pictures.create({ name: 'Reader Pic' }, function (err, p) {
          should.not.exist(err);
          should.exist(p);
          p.imageableId.should.eql(reader.id);
          p.imageableType.should.equal('Reader');
          done();
        });
      });
    });
    
    it('should find polymorphic items - author', function (done) {
      Author.findOne(function (err, author) {
        author.pictures(function (err, pics) {
          should.not.exist(err);
          
          var pictures = author.pictures();
          pictures.should.eql(pics);
          
          pics.should.have.length(1);
          pics[0].name.should.equal('Author Pic');
          done();
        });
      });
    });
    
    it('should find polymorphic items - reader', function (done) {
      Reader.findOne(function (err, reader) {
        reader.pictures(function (err, pics) {
          should.not.exist(err);
          pics.should.have.length(1);
          pics[0].name.should.equal('Reader Pic');
          done();
        });
      });
    });
    
    it('should find the inverse of polymorphic relation - author', function (done) {
      Picture.findOne({ where: { name: 'Author Pic' } }, function (err, p) {
        should.not.exist(err);
        p.imageableType.should.equal('Author');
        p.imageable(function(err, imageable) {
          should.not.exist(err);
          imageable.should.be.instanceof(Author);
          imageable.name.should.equal('Author 1');
          done();
        });
      });
    });
    
    it('should find the inverse of polymorphic relation - reader', function (done) {
      Picture.findOne({ where: { name: 'Reader Pic' } }, function (err, p) {
        should.not.exist(err);
        p.imageableType.should.equal('Reader');
        p.imageable(function(err, imageable) {
          should.not.exist(err);
          imageable.should.be.instanceof(Reader);
          imageable.name.should.equal('Reader 1');
          done();
        });
      });
    });
    
    it('should include the inverse of polymorphic relation', function (done) {
      Picture.find({ include: 'imageable' }, function (err, pics) {
        should.not.exist(err);
        pics.should.have.length(2);
        pics[0].name.should.equal('Author Pic');
        pics[0].imageable().name.should.equal('Author 1');
        pics[1].name.should.equal('Reader Pic');
        pics[1].imageable().name.should.equal('Reader 1');
        done();
      });
    });
    
    it('should assign a polymorphic relation', function(done) {
      Author.create({ name: 'Author 2' }, function(err, author) {
        var p = new Picture({ name: 'Sample' });
        p.imageable(author); // assign
        p.imageableId.should.eql(author.id);
        p.imageableType.should.equal('Author');
        p.save(done);
      });
    });
    
    it('should find polymorphic items - author', function (done) {
      Author.findOne({ where: { name: 'Author 2' } }, function (err, author) {
        author.pictures(function (err, pics) {
          should.not.exist(err);
          pics.should.have.length(1);
          pics[0].name.should.equal('Sample');
          done();
        });
      });
    });
    
    it('should find the inverse of polymorphic relation - author', function (done) {
      Picture.findOne({ where: { name: 'Sample' } }, function (err, p) {
        should.not.exist(err);
        p.imageableType.should.equal('Author');
        p.imageable(function(err, imageable) {
          should.not.exist(err);
          imageable.should.be.instanceof(Author);
          imageable.name.should.equal('Author 2');
          done();
        });
      });
    });
    
  });
  
  describe('polymorphic hasAndBelongsToMany through', function () {
    before(function (done) {
      db = getSchema();
      Picture = db.define('Picture', {name: String});
      Author = db.define('Author', {name: String});
      Reader = db.define('Reader', {name: String});
      PictureLink = db.define('PictureLink', {});

      db.automigrate(function () {
        Picture.destroyAll(function () {
          PictureLink.destroyAll(function () {
            Author.destroyAll(function () {
              Reader.destroyAll(done);
            });
          });
        });
      });
    });

    it('can be declared', function (done) {
      Author.hasAndBelongsToMany(Picture, { through: PictureLink, polymorphic: 'imageable' });
      Reader.hasAndBelongsToMany(Picture, { through: PictureLink, polymorphic: 'imageable' });
      // Optionally, define inverse relations:
      Picture.hasMany(Author, { through: PictureLink, polymorphic: 'imageable', invert: true });
      Picture.hasMany(Reader, { through: PictureLink, polymorphic: 'imageable', invert: true });
      db.automigrate(done);
    });

    it('can determine the collect via modelTo name', function () {
      Author.hasAndBelongsToMany(Picture, { through: PictureLink, polymorphic: 'imageable' });
      Reader.hasAndBelongsToMany(Picture, { through: PictureLink, polymorphic: 'imageable' });
      // Optionally, define inverse relations:
      Picture.hasMany(Author, { through: PictureLink, polymorphic: 'imageable', invert: true });
      Picture.hasMany(Reader, { through: PictureLink, polymorphic: 'imageable', invert: true });
      var author = new Author({id: 1});
      var scope1 = author.pictures._scope;
      scope1.should.have.property('collect', 'picture');
      scope1.should.have.property('include', 'picture');
      var reader = new Reader({id: 1});
      var scope2 = reader.pictures._scope;
      scope2.should.have.property('collect', 'picture');
      scope2.should.have.property('include', 'picture');
      var picture = new Picture({id: 1});
      var scope3 = picture.authors._scope;
      scope3.should.have.property('collect', 'imageable');
      scope3.should.have.property('include', 'imageable');
      var scope4 = picture.readers._scope;
      scope4.should.have.property('collect', 'imageable');
      scope4.should.have.property('include', 'imageable');
    });

    var author, reader, pictures = [];
    it('should create polymorphic relation - author', function (done) {
      Author.create({ name: 'Author 1' }, function (err, a) {
        should.not.exist(err);
        author = a;
        author.pictures.create({ name: 'Author Pic 1' }, function (err, p) {
          should.not.exist(err);
          pictures.push(p);
          author.pictures.create({ name: 'Author Pic 2' }, function (err, p) {
            should.not.exist(err);
            pictures.push(p);
            done();
          });
        });
      });
    });
    
    it('should create polymorphic relation - reader', function (done) {
      Reader.create({ name: 'Reader 1' }, function (err, r) {
        should.not.exist(err);
        reader = r;
        reader.pictures.create({ name: 'Reader Pic 1' }, function (err, p) {
          should.not.exist(err);
          pictures.push(p);
          done();
        });
      });
    });
    
    it('should create polymorphic through model', function (done) {
      PictureLink.findOne(function(err, link) {
        should.not.exist(err);
        link.pictureId.should.eql(pictures[0].id); // eql for mongo ObjectId
        link.imageableId.should.eql(author.id);
        link.imageableType.should.equal('Author');
        link.imageable(function(err, imageable) {
          imageable.should.be.instanceof(Author);
          imageable.id.should.eql(author.id);
          done();
        });
      });
    });
    
    it('should get polymorphic relation through model - author', function (done) {
      Author.findById(author.id, function(err, author) {
        should.not.exist(err);
        author.name.should.equal('Author 1');
        author.pictures(function(err, pics) {
          should.not.exist(err);
          pics.should.have.length(2);
          pics[0].name.should.equal('Author Pic 1');
          pics[1].name.should.equal('Author Pic 2');
          done();
        });
      });
    });
    
    it('should get polymorphic relation through model - reader', function (done) {
      Reader.findById(reader.id, function(err, reader) {
        should.not.exist(err);
        reader.name.should.equal('Reader 1');
        reader.pictures(function(err, pics) {
          should.not.exist(err);
          pics.should.have.length(1);
          pics[0].name.should.equal('Reader Pic 1');
          done();
        });
      });
    });
    
    it('should include polymorphic items', function (done) {
      Author.find({ include: 'pictures' }, function(err, authors) {
        authors.should.have.length(1);
        authors[0].pictures(function(err, pics) {
          pics.should.have.length(2);
          pics[0].name.should.equal('Author Pic 1');
          pics[1].name.should.equal('Author Pic 2');
          done();
        });
      });
    });

    var anotherPicture;
    it('should add to a polymorphic relation - author', function (done) {
      Author.findById(author.id, function(err, author) {
        Picture.create({name: 'Example' }, function(err, p) {
          should.not.exist(err);
          pictures.push(p);
          anotherPicture = p;
          author.pictures.add(p, function(err, link) {
            link.should.be.instanceof(PictureLink);
            link.pictureId.should.eql(p.id);
            link.imageableId.should.eql(author.id);
            link.imageableType.should.equal('Author');
            done();
          });
        });
      });
    });
    
    it('should create polymorphic through model', function (done) {
      PictureLink.findOne({ where: { pictureId: anotherPicture.id, imageableType: 'Author' } }, function(err, link) {
        should.not.exist(err);
        link.pictureId.should.eql(anotherPicture.id);
        link.imageableId.should.eql(author.id);
        link.imageableType.should.equal('Author');
        done();
      });
    });

    var anotherAuthor, anotherReader;
    it('should add to a polymorphic relation - author', function (done) {
      Author.create({ name: 'Author 2' }, function (err, author) {
        should.not.exist(err);
        anotherAuthor = author;
        author.pictures.add(anotherPicture.id, function (err, p) {
          should.not.exist(err);
          done();
        });
      });
    });
    
    it('should add to a polymorphic relation - author', function (done) {
      Reader.create({name: 'Reader 2' }, function (err, reader) {
        should.not.exist(err);
        anotherReader = reader;
        reader.pictures.add(anotherPicture.id, function (err, p) {
          should.not.exist(err);
          done();
        });
      });
    });
    
    it('should get the inverse polymorphic relation - author', function (done) {
      Picture.findById(anotherPicture.id, function(err, p) {
        p.authors(function(err, authors) {
          authors.should.have.length(2);
          authors[0].name.should.equal('Author 1');
          authors[1].name.should.equal('Author 2');
          done();
        });
      });
    });
    
    it('should get the inverse polymorphic relation - reader', function (done) {
      Picture.findById(anotherPicture.id, function(err, p) {
        p.readers(function(err, readers) {
          readers.should.have.length(1);
          readers[0].name.should.equal('Reader 2');
          done();
        });
      });
    });
    
    it('should find polymorphic items - author', function (done) {
      Author.findById(author.id, function(err, author) {
        author.pictures(function(err, pics) {
          pics.should.have.length(3);
          pics[0].name.should.equal('Author Pic 1');
          pics[1].name.should.equal('Author Pic 2');
          pics[2].name.should.equal('Example');
          done();
        });
      });
    });
    
    it('should check if polymorphic relation exists - author', function (done) {
      Author.findById(author.id, function(err, author) {
        author.pictures.exists(anotherPicture.id, function(err, exists) {
          exists.should.be.true;
          done();
        });
      });
    });
    
    it('should remove from a polymorphic relation - author', function (done) {
      Author.findById(author.id, function(err, author) {
        author.pictures.remove(anotherPicture.id, function(err) {
          should.not.exist(err);
          done();
        });
      });
    });
    
    it('should find polymorphic items - author', function (done) {
      Author.findById(author.id, function(err, author) {
        author.pictures(function(err, pics) {
          pics.should.have.length(2);
          pics[0].name.should.equal('Author Pic 1');
          pics[1].name.should.equal('Author Pic 2');
          done();
        });
      });
    });
    
    it('should check if polymorphic relation exists - author', function (done) {
      Author.findById(author.id, function(err, author) {
        author.pictures.exists(7, function(err, exists) {
          exists.should.be.false;
          done();
        });
      });
    });
    
    it('should create polymorphic item through relation scope', function (done) {
      Picture.findById(anotherPicture.id, function(err, p) {
        p.authors.create({ name: 'Author 3' }, function(err, a) {
          should.not.exist(err);
          author = a;
          author.name.should.equal('Author 3');
          done();
        });
      });
    });
    
    it('should create polymorphic through model - new author', function (done) {
      PictureLink.findOne({ where: { 
          pictureId: anotherPicture.id, imageableId: author.id, imageableType: 'Author'
        } }, function(err, link) {
        should.not.exist(err);
        link.pictureId.should.eql(anotherPicture.id);
        link.imageableId.should.eql(author.id);
        link.imageableType.should.equal('Author');
        done();
      });
    });
    
    it('should find polymorphic items - new author', function (done) {
      Author.findById(author.id, function(err, author) {
        author.pictures(function(err, pics) {
          pics.should.have.length(1);
          pics[0].id.should.eql(anotherPicture.id);
          pics[0].name.should.equal('Example');
          done();
        });
      });
    });
  
  });

  describe('belongsTo', function () {
    var List, Item, Fear, Mind;
    
    var listId, itemId;

    it('can be declared in different ways', function () {
      List = db.define('List', {name: String});
      Item = db.define('Item', {name: String});
      Fear = db.define('Fear');
      Mind = db.define('Mind');

      // syntax 1 (old)
      Item.belongsTo(List);
      Object.keys((new Item).toObject()).should.include('listId');
      (new Item).list.should.be.an.instanceOf(Function);

      // syntax 2 (new)
      Fear.belongsTo('mind');
      Object.keys((new Fear).toObject()).should.include('mindId');
      (new Fear).mind.should.be.an.instanceOf(Function);
      // (new Fear).mind.build().should.be.an.instanceOf(Mind);
    });

    it('can be used to query data', function (done) {
      List.hasMany('todos', {model: Item});
      db.automigrate(function () {
        List.create({name: 'List 1'}, function (e, list) {
          listId = list.id;
          should.not.exist(e);
          should.exist(list);
          list.todos.create({name: 'Item 1'},function (err, todo) {
            itemId = todo.id;
            todo.list(function (e, l) {
              should.not.exist(e);
              should.exist(l);
              l.should.be.an.instanceOf(List);
              todo.list().id.should.equal(l.id);
              todo.list().name.should.equal('List 1');
              done();
            });
          });
        });
      });
    });

    it('could accept objects when creating on scope', function (done) {
      List.create(function (e, list) {
        should.not.exist(e);
        should.exist(list);
        Item.create({list: list}, function (err, item) {
          should.not.exist(err);
          should.exist(item);
          should.exist(item.listId);
          item.listId.should.equal(list.id);
          item.__cachedRelations.list.should.equal(list);
          done();
        });
      });
    });
    
    it('should update related item on scope', function(done) {
      Item.findById(itemId, function (e, todo) {
        todo.list.update({name: 'List A'}, function(err, list) {
          should.not.exist(err);
          should.exist(list);
          list.name.should.equal('List A');
          done();
        });
      });
    });
    
    it('should get related item on scope', function(done) {
      Item.findById(itemId, function (e, todo) {
        todo.list(function(err, list) {
          should.not.exist(err);
          should.exist(list);
          list.name.should.equal('List A');
          done();
        });
      });
    });
    
    it('should destroy related item on scope', function(done) {
      Item.findById(itemId, function (e, todo) {
        todo.list.destroy(function(err) {
          should.not.exist(err);
          done();
        });
      });
    });
    
    it('should get related item on scope - verify', function(done) {
      Item.findById(itemId, function (e, todo) {
        todo.list(function(err, list) {
          should.not.exist(err);
          should.not.exist(list);
          done();
        });
      });
    });
    
    it('should not have deleted related item', function(done) {
      List.findById(listId, function (e, list) {
        should.not.exist(e);
        should.exist(list);
        done();
      });
    });

  });
  
  describe('belongsTo with scope', function () {
    var Person, Passport;
    
    it('can be declared with scope and properties', function (done) {
      Person = db.define('Person', {name: String, age: Number, passportNotes: String});
      Passport = db.define('Passport', {name: String, notes: String});
      Passport.belongsTo(Person, {
        properties: { notes: 'passportNotes' },
        scope: { fields: { id: true, name: true } }
      });
      db.automigrate(done);
    });

    var personCreated;
    it('should create record on scope', function (done) {
      var p = new Passport({ name: 'Passport', notes: 'Some notes...' });
      p.person.create({name: 'Fred', age: 36 }, function(err, person) {
        personCreated = person;
        p.personId.should.equal(person.id);
        person.name.should.equal('Fred');
        person.passportNotes.should.equal('Some notes...');
        done();
      });
    });
    
    it('should find record on scope', function (done) {
      Passport.findOne(function (err, p) {
        p.personId.should.eql(personCreated.id);
        p.person(function(err, person) {
          person.name.should.equal('Fred');
          person.should.not.have.property('age');
          person.should.not.have.property('passportNotes');
          done();
        });
      });
    });
  
  });

  describe('hasOne', function () {
    var Supplier, Account;
    var supplierId, accountId;

    before(function () {
      db = getSchema();
      Supplier = db.define('Supplier', {name: String});
      Account = db.define('Account', {accountNo: String, supplierName: String});
    });

    it('can be declared using hasOne method', function () {
      Supplier.hasOne(Account, { properties: { name: 'supplierName' } });
      Object.keys((new Account()).toObject()).should.include('supplierId');
      (new Supplier()).account.should.be.an.instanceOf(Function);
    });

    it('can be used to query data', function (done) {
      db.automigrate(function () {
        Supplier.create({name: 'Supplier 1'}, function (e, supplier) {
          supplierId = supplier.id;
          should.not.exist(e);
          should.exist(supplier);
          supplier.account.create({accountNo: 'a01'}, function (err, account) {
            supplier.account(function (e, act) {
              accountId = act.id;
              should.not.exist(e);
              should.exist(act);
              act.should.be.an.instanceOf(Account);
              supplier.account().id.should.equal(act.id);
              act.supplierName.should.equal(supplier.name);
              done();
            });
          });
        });
      });
    });

    it('should set targetClass on scope property', function() {
      should.equal(Supplier.prototype.account._targetClass, 'Account');
    });
    
    it('should update the related item on scope', function(done) {
      Supplier.findById(supplierId, function(e, supplier) {
        should.not.exist(e);
        should.exist(supplier);
        supplier.account.update({supplierName: 'Supplier A'}, function(err, act) {
          should.not.exist(e);
          act.supplierName.should.equal('Supplier A');
          done();
        });
      });
    });
    
    it('should get the related item on scope', function(done) {
      Supplier.findById(supplierId, function(e, supplier) {
        should.not.exist(e);
        should.exist(supplier);
        supplier.account(function(err, act) {
          should.not.exist(e);
          should.exist(act);
          act.supplierName.should.equal('Supplier A');
          done();
        });
      });
    });
    
    it('should destroy the related item on scope', function(done) {
      Supplier.findById(supplierId, function(e, supplier) {
        should.not.exist(e);
        should.exist(supplier);
        supplier.account.destroy(function(err) {
          should.not.exist(e);
          done();
        });
      });
    });
    
    it('should get the related item on scope - verify', function(done) {
      Supplier.findById(supplierId, function(e, supplier) {
        should.not.exist(e);
        should.exist(supplier);
        supplier.account(function(err, act) {
          should.not.exist(e);
          should.not.exist(act);
          done();
        });
      });
    });
    
    it('should have deleted related item', function(done) {
      Supplier.findById(supplierId, function (e, supplier) {
        should.not.exist(e);
        should.exist(supplier);
        done();
      });
    });
    
  });
  
  describe('hasOne with non standard id', function () {
    var Supplier, Account;
    var supplierId, accountId;
    
    before(function () {
      db = getSchema();
      Supplier = db.define('Supplier', {
        sid: {
          type: String,
          id: true
        },
        name: String
      });
      Account = db.define('Account', {
        accid: {
          type: String,
          id: true,
          generated: false
        },
        supplierName: String
      });
    });
    
    it('can be declared with non standard foreignKey', function () {
      Supplier.hasOne(Account, {
        properties: {name: 'supplierName'},
        foreignKey: 'sid'
      });
      Object.keys((new Account()).toObject()).should.include('sid');
      (new Supplier()).account.should.be.an.instanceOf(Function);
    });
    
    it('can be used to query data', function (done) {
      db.automigrate(function () {
        Supplier.create({name: 'Supplier 1'}, function (e, supplier) {
          supplierId = supplier.sid;
          should.not.exist(e);
          should.exist(supplier);
          supplier.account.create({accid: 'a01'}, function (err, account) {
            supplier.account(function (e, act) {
              accountId = act.accid;
              should.not.exist(e);
              should.exist(act);
              act.should.be.an.instanceOf(Account);
              supplier.account().accid.should.equal(act.accid);
              act.supplierName.should.equal(supplier.name);
              done();
            });
          });
        });
      });
    });
    
    it('should destroy the related item on scope', function(done) {
      Supplier.findById(supplierId, function(e, supplier) {
        should.not.exist(e);
        should.exist(supplier);
        supplier.account.destroy(function(err) {
          should.not.exist(e);
          done();
        });
      });
    });
    
    it('should get the related item on scope - verify', function(done) {
      Supplier.findById(supplierId, function(e, supplier) {
        should.not.exist(e);
        should.exist(supplier);
        supplier.account(function(err, act) {
          should.not.exist(e);
          should.not.exist(act);
          done();
        });
      });
    });
    
    it('should have deleted related item', function(done) {
      Supplier.findById(supplierId, function (e, supplier) {
        should.not.exist(e);
        should.exist(supplier);
        done();
      });
    });
  
  });
  
  describe('hasAndBelongsToMany', function () {
    var Article, TagName, ArticleTag;
    it('can be declared', function (done) {
      Article = db.define('Article', {title: String});
      TagName = db.define('TagName', {name: String});
      Article.hasAndBelongsToMany('tagNames');
      ArticleTag = db.models.ArticleTagName;
      db.automigrate(function () {
        Article.destroyAll(function () {
          TagName.destroyAll(function () {
            ArticleTag.destroyAll(done)
          });
        });
      });
    });

    it('should allow to create instances on scope', function (done) {
      Article.create(function (e, article) {
        article.tagNames.create({name: 'popular'}, function (e, t) {
          t.should.be.an.instanceOf(TagName);
          ArticleTag.findOne(function (e, at) {
            should.exist(at);
            at.tagNameId.toString().should.equal(t.id.toString());
            at.articleId.toString().should.equal(article.id.toString());
            done();
          });
        });
      });
    });

    it('should allow to fetch scoped instances', function (done) {
      Article.findOne(function (e, article) {
        article.tagNames(function (e, tags) {
          should.not.exist(e);
          should.exist(tags);
          
          article.tagNames().should.eql(tags);
          
          done();
        });
      });
    });

    it('should allow to add connection with instance', function (done) {
      Article.findOne(function (e, article) {
        TagName.create({name: 'awesome'}, function (e, tag) {
          article.tagNames.add(tag, function (e, at) {
            should.not.exist(e);
            should.exist(at);
            at.should.be.an.instanceOf(ArticleTag);
            at.tagNameId.should.equal(tag.id);
            at.articleId.should.equal(article.id);
            done();
          });
        });
      });
    });

    it('should allow to remove connection with instance', function (done) {
      Article.findOne(function (e, article) {
        article.tagNames(function (e, tags) {
          var len = tags.length;
          tags.should.not.be.empty;
          article.tagNames.remove(tags[0], function (e) {
            should.not.exist(e);
            article.tagNames(true, function (e, tags) {
              tags.should.have.lengthOf(len - 1);
              done();
            });
          });
        });
      });
    });

    it('should set targetClass on scope property', function() {
      should.equal(Article.prototype.tagNames._targetClass, 'TagName');
    });
  });
  
  describe('embedsOne', function () {
    
    var person;
    var Other;
    
    before(function () {
      tmp = getTransientDataSource();
      db = getSchema();
      Person = db.define('Person', {name: String});
      Passport = tmp.define('Passport',
        {name:{type:'string', required: true}}, 
        {idInjection: false}
      );
      Other = db.define('Other', {name: String});
    });

    it('can be declared using embedsOne method', function (done) {
      Person.embedsOne(Passport, {
        default: {name: 'Anonymous'} // a bit contrived
      });
      db.automigrate(done);
    });
    
    it('should have setup a property and accessor', function() {
      var p = new Person();
      p.passport.should.be.an.object; // because of default
      p.passportItem.should.be.a.function;
      p.passportItem.create.should.be.a.function;
      p.passportItem.build.should.be.a.function;
      p.passportItem.destroy.should.be.a.function;
    });
    
    it('should return an instance with default values', function() {
      var p = new Person();
      p.passport.toObject().should.eql({name: 'Anonymous'});
      p.passportItem().should.equal(p.passport);
      p.passportItem(function(err, passport) {
        should.not.exist(err);
        passport.should.equal(p.passport);
      });
    });
    
    it('should embed a model instance', function() {
      var p = new Person();
      p.passportItem(new Passport({name: 'Fred'}));
      p.passport.toObject().should.eql({name: 'Fred'});
      p.passport.should.be.an.instanceOf(Passport);
    });
    
    it('should not embed an invalid model type', function() {
      var p = new Person();
      p.passportItem(new Other());
      p.passport.toObject().should.eql({name: 'Anonymous'});
      p.passport.should.be.an.instanceOf(Passport);
    });

    var personId;
    it('should create an embedded item on scope', function(done) {
      Person.create({name: 'Fred'}, function(err, p) {
        should.not.exist(err);
        personId = p.id;
        p.passportItem.create({name: 'Fredric'}, function(err, passport) {
          should.not.exist(err);
          p.passport.toObject().should.eql({name: 'Fredric'});
          p.passport.should.be.an.instanceOf(Passport);
          done();
        });
      });
    });
    
    it('should get an embedded item on scope', function(done) {
      Person.findById(personId, function(err, p) {
        should.not.exist(err);
        var passport = p.passportItem();
        passport.toObject().should.eql({name: 'Fredric'});
        passport.should.be.an.instanceOf(Passport);
        passport.should.equal(p.passport);
        passport.should.equal(p.passportItem.value());
        done();
      });
    });
    
    it('should validate an embedded item on scope - on creation', function(done) {
      var p = new Person({name: 'Fred'});
      p.passportItem.create({}, function(err, passport) {
        should.exist(err);
        err.name.should.equal('ValidationError');
        var msg = 'The `Passport` instance is not valid.';
        msg += ' Details: `name` can\'t be blank.';
        err.message.should.equal(msg);
        done();
      });
    });
    
    it('should validate an embedded item on scope - on update', function(done) {
      Person.findById(personId, function(err, p) {
        var passport = p.passportItem();
        passport.name = null;
        p.save(function(err) {
          should.exist(err);
          err.name.should.equal('ValidationError');
          var msg = 'The `Person` instance is not valid.';
          msg += ' Details: `passportItem` is invalid: `name` can\'t be blank.';
          err.message.should.equal(msg);
          done();
        });
      });
    });
    
    it('should update an embedded item on scope', function(done) {
      Person.findById(personId, function(err, p) {
        p.passportItem.update({name: 'Freddy'}, function(err, passport) {
          should.not.exist(err);
          var passport = p.passportItem();
          passport.toObject().should.eql({name: 'Freddy'});
          passport.should.be.an.instanceOf(Passport);
          passport.should.equal(p.passport);
          done();
        });
      });
    });
    
    it('should get an embedded item on scope - verify', function(done) {
      Person.findById(personId, function(err, p) {
        should.not.exist(err);
        var passport = p.passportItem();
        passport.toObject().should.eql({name: 'Freddy'});
        done();
      });
    });
    
    it('should destroy an embedded item on scope', function(done) {
      Person.findById(personId, function(err, p) {
        p.passportItem.destroy(function(err) {
          should.not.exist(err);
          should.equal(p.passport, null);
          done();
        });
      });
    });
    
    it('should get an embedded item on scope - verify', function(done) {
      Person.findById(personId, function(err, p) {
        should.not.exist(err);
        should.equal(p.passport, null);
        done();
      });
    });
    
  });
  
  describe('embedsOne - persisted model', function () {
    
    // This test spefically uses the Memory connector
    // in order to test the use of the auto-generated
    // id, in the sequence of the related model.
    
    before(function () {
      db = getMemoryDataSource();
      Person = db.define('Person', {name: String});
      Passport = db.define('Passport',
        {name:{type:'string', required: true}}
      );
    });

    it('can be declared using embedsOne method', function (done) {
      Person.embedsOne(Passport, {
        options: {persistent: true}
      });
      db.automigrate(done);
    });
    
    it('should create an item - to offset id', function(done) {
      Passport.create({name:'Wilma'}, function(err, p) {
        should.not.exist(err);
        p.id.should.equal(1);
        p.name.should.equal('Wilma');
        done();
      });
    });
    
    it('should create an embedded item on scope', function(done) {
      Person.create({name: 'Fred'}, function(err, p) {
        should.not.exist(err);
        p.passportItem.create({name: 'Fredric'}, function(err, passport) {
          should.not.exist(err);
          p.passport.id.should.eql(2);
          p.passport.name.should.equal('Fredric');
          done();
        });
      });
    });
    
  });
  
  describe('embedsOne - generated id', function () {
    
    before(function () {
      tmp = getTransientDataSource();
      db = getSchema();
      Person = db.define('Person', {name: String});
      Passport = tmp.define('Passport',
        {id: {type:'string', id: true, generated:true}},
        {name: {type:'string', required: true}}
      );
    });

    it('can be declared using embedsOne method', function (done) {
      Person.embedsOne(Passport);
      db.automigrate(done);
    });
    
    it('should create an embedded item on scope', function(done) {
      Person.create({name: 'Fred'}, function(err, p) {
        should.not.exist(err);
        p.passportItem.create({name: 'Fredric'}, function(err, passport) {
          should.not.exist(err);
          passport.id.should.match(/^[0-9a-fA-F]{24}$/);
          p.passport.name.should.equal('Fredric');
          done();
        });
      });
    });
    
  });
  
  describe('embedsMany', function () {
    
    var address1, address2;
    
    before(function (done) {
      tmp = getTransientDataSource({defaultIdType: Number});
      db = getSchema();
      Person = db.define('Person', {name: String});
      Address = tmp.define('Address', {street: String});
      Address.validatesPresenceOf('street');

      db.automigrate(function () {
        Person.destroyAll(done);
      });
    });

    it('can be declared', function (done) {
      Person.embedsMany(Address);
      db.automigrate(done);
    });
    
    it('should have setup embedded accessor/scope', function() {
      var p = new Person({ name: 'Fred' });
      p.addresses.should.be.an.array;
      p.addresses.should.have.length(0);
      p.addressList.should.be.a.function;
      p.addressList.findById.should.be.a.function;
      p.addressList.updateById.should.be.a.function;
      p.addressList.destroy.should.be.a.function;
      p.addressList.exists.should.be.a.function;
      p.addressList.create.should.be.a.function;
      p.addressList.build.should.be.a.function;
    });

    it('should create embedded items on scope', function(done) {
      Person.create({ name: 'Fred' }, function(err, p) {
        p.addressList.create({ street: 'Street 1' }, function(err, address) {
          should.not.exist(err);
          address1 = address;
          should.exist(address1.id);
          address1.street.should.equal('Street 1');
          done();
        });
      });
    });
    
    it('should create embedded items on scope', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.create({ street: 'Street 2' }, function(err, address) {
          should.not.exist(err);
          address2 = address;
          should.exist(address2.id);
          address2.street.should.equal('Street 2');
          done();
        });
      });
    });
    
    it('should return embedded items from scope', function(done) {
      Person.findOne(function(err, p) {
        p.addressList(function(err, addresses) {
          should.not.exist(err);
          
          var list = p.addressList();
          list.should.equal(addresses);
          list.should.equal(p.addresses);
          
          p.addressList.value().should.equal(list);
          
          addresses.should.have.length(2);
          addresses[0].id.should.eql(address1.id);
          addresses[0].street.should.equal('Street 1');
          addresses[1].id.should.eql(address2.id);
          addresses[1].street.should.equal('Street 2');
          done();
        });
      });
    });
    
    it('should filter embedded items on scope', function(done) {
      Person.findOne(function(err, p) {
        p.addressList({ where: { street: 'Street 2' } }, function(err, addresses) {
          should.not.exist(err);
          addresses.should.have.length(1);
          addresses[0].id.should.eql(address2.id);
          addresses[0].street.should.equal('Street 2');
          done();
        });
      });
    });
    
    it('should validate embedded items', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.create({}, function(err, address) {
          should.exist(err);
          should.not.exist(address);
          err.name.should.equal('ValidationError');
          err.details.codes.street.should.eql(['presence']);
          done();
        });
      });
    });
    
    it('should find embedded items by id', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.findById(address2.id, function(err, address) {
          address.should.be.instanceof(Address);
          address.id.should.eql(address2.id);
          address.street.should.equal('Street 2');
          done();
        });
      });
    });
    
    it('should check if item exists', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.exists(address2.id, function(err, exists) {
          should.not.exist(err);
          exists.should.be.true;
          done();
        });
      });
    });
    
    it('should update embedded items by id', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.updateById(address2.id, { street: 'New Street' }, function(err, address) {
          address.should.be.instanceof(Address);
          address.id.should.eql(address2.id);
          address.street.should.equal('New Street');
          done();
        });
      });
    });
    
    it('should validate the update of embedded items', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.updateById(address2.id, { street: null }, function(err, address) {
          err.name.should.equal('ValidationError');
          err.details.codes.street.should.eql(['presence']);
          done();
        });
      });
    });
    
    it('should find embedded items by id - verify', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.findById(address2.id, function(err, address) {
          address.should.be.instanceof(Address);
          address.id.should.eql(address2.id);
          address.street.should.equal('New Street');
          done();
        });
      });
    });
    
    it('should have accessors: at, get, set', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.at(0).id.should.equal(address1.id);
        p.addressList.get(address1.id).id.should.equal(address1.id);
        p.addressList.set(address1.id, { street: 'Changed 1' });
        p.addresses[0].street.should.equal('Changed 1');
        p.addressList.at(1).id.should.equal(address2.id);
        p.addressList.get(address2.id).id.should.equal(address2.id);
        p.addressList.set(address2.id, { street: 'Changed 2' });
        p.addresses[1].street.should.equal('Changed 2');
        done();
      });
    });
    
    it('should remove embedded items by id', function(done) {
      Person.findOne(function(err, p) {
        p.addresses.should.have.length(2);
        p.addressList.destroy(address1.id, function(err) {
          should.not.exist(err);
          p.addresses.should.have.length(1);
          done();
        });
      });
    });
    
    it('should have embedded items - verify', function(done) {
      Person.findOne(function(err, p) {
        p.addresses.should.have.length(1);
        done();
      });
    });
    
  });
  
  describe('embedsMany - numeric ids + forceId', function () {
    
    before(function (done) {
      tmp = getTransientDataSource();
      db = getSchema();
      Person = db.define('Person', {name: String});
      Address = tmp.define('Address', {
        id: {type: Number, id:true},
        street: String
      });

      db.automigrate(function () {
        Person.destroyAll(done);
      });
    });

    it('can be declared', function (done) {
      Person.embedsMany(Address, {options: {forceId: true}});
      db.automigrate(done);
    });
    
    it('should create embedded items on scope', function(done) {
      Person.create({ name: 'Fred' }, function(err, p) {
        p.addressList.create({ street: 'Street 1' }, function(err, address) {
          should.not.exist(err);
          address.id.should.equal(1);
          p.addressList.create({ street: 'Street 2' }, function(err, address) {
            address.id.should.equal(2);
            p.addressList.create({ id: 12345, street: 'Street 3' }, function(err, address) {
              address.id.should.equal(3);
              done();
            });
          });
        });
      });
    });
    
  });
  
  describe('embedsMany - explicit ids', function () {
    before(function (done) {
      tmp = getTransientDataSource();
      db = getSchema();
      Person = db.define('Person', {name: String});
      Address = tmp.define('Address', {street: String});
      Address.validatesPresenceOf('street');

      db.automigrate(function () {
        Person.destroyAll(done);
      });
    });

    it('can be declared', function (done) {
      Person.embedsMany(Address);
      db.automigrate(done);
    });
    
    it('should create embedded items on scope', function(done) {
      Person.create({ name: 'Fred' }, function(err, p) {
        p.addressList.create({ id: 'home', street: 'Street 1' }, function(err, address) {
          should.not.exist(err);
          p.addressList.create({ id: 'work', street: 'Work Street 2' }, function(err, address) {
            should.not.exist(err);
            address.id.should.equal('work');
            address.street.should.equal('Work Street 2');
            done();
          });
        });
      });
    });
    
    it('should find embedded items by id', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.findById('work', function(err, address) {
          address.should.be.instanceof(Address);
          address.id.should.equal('work');
          address.street.should.equal('Work Street 2');
          done();
        });
      });
    });
    
    it('should check for duplicate ids', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.create({ id: 'home', street: 'Invalid' }, function(err, addresses) {
          should.exist(err);
          err.name.should.equal('ValidationError');
          err.details.codes.addresses.should.eql(['uniqueness']);
          done();
        });
      });
    });
    
    it('should update embedded items by id', function(done) {
      Person.findOne(function(err, p) {
        p.addressList.updateById('home', { street: 'New Street' }, function(err, address) {
          address.should.be.instanceof(Address);
          address.id.should.equal('home');
          address.street.should.equal('New Street');
          done();
        });
      });
    });
    
    it('should remove embedded items by id', function(done) {
      Person.findOne(function(err, p) {
        p.addresses.should.have.length(2);
        p.addressList.destroy('home', function(err) {
          should.not.exist(err);
          p.addresses.should.have.length(1);
          done();
        });
      });
    });
    
    it('should have embedded items - verify', function(done) {
      Person.findOne(function(err, p) {
        p.addresses.should.have.length(1);
        done();
      });
    });
    
    it('should validate all embedded items', function(done) {
      var addresses = [];
      addresses.push({ id: 'home', street: 'Home Street' });
      addresses.push({ id: 'work', street: '' });
      Person.create({ name: 'Wilma', addresses: addresses }, function(err, p) {
        err.name.should.equal('ValidationError');
        var expected = 'The `Person` instance is not valid. ';
        expected += 'Details: `addresses` contains invalid item: `work` (`street` can\'t be blank).';
        err.message.should.equal(expected);
        done();
      });
    });
    
    it('should build embedded items', function(done) {
      Person.create({ name: 'Wilma' }, function(err, p) {
        p.addressList.build({ id: 'home', street: 'Home' });
        p.addressList.build({ id: 'work', street: 'Work' });
        p.addresses.should.have.length(2);
        p.save(function(err, p) {
          done();
        });
      });
    });
    
    it('should have embedded items - verify', function(done) {
      Person.findOne({ where: { name: 'Wilma' } }, function(err, p) {
        p.name.should.equal('Wilma');
        p.addresses.should.have.length(2);
        p.addresses[0].id.should.equal('home');
        p.addresses[0].street.should.equal('Home');
        p.addresses[1].id.should.equal('work');
        p.addresses[1].street.should.equal('Work');
        done();
      });
    });
    
    it('should have accessors: at, get, set', function(done) {
      Person.findOne({ where: { name: 'Wilma' } }, function(err, p) {
        p.name.should.equal('Wilma');
        p.addresses.should.have.length(2);
        p.addressList.at(0).id.should.equal('home');
        p.addressList.get('home').id.should.equal('home');
        p.addressList.set('home', { id: 'den' }).id.should.equal('den');
        p.addressList.at(1).id.should.equal('work');
        p.addressList.get('work').id.should.equal('work');
        p.addressList.set('work', { id: 'factory' }).id.should.equal('factory');
        done();
      });
    });
    
    it('should create embedded from attributes - property name', function(done) {
      var addresses = [
        {id: 'home', street: 'Home Street'},
        {id: 'work', street: 'Work Street'}
      ];
      Person.create({name: 'Wilma', addresses: addresses}, function(err, p) {
        should.not.exist(err);
        p.addressList.at(0).id.should.equal('home');
        p.addressList.at(1).id.should.equal('work');
        done();
      });
    });
    
    it('should not create embedded from attributes - relation name', function(done) {
      var addresses = [
        {id: 'home', street: 'Home Street'},
        {id: 'work', street: 'Work Street'}
      ];
      Person.create({name: 'Wilma', addressList: addresses}, function(err, p) {
        should.not.exist(err);
        p.addresses.should.have.length(0);
        done();
      });
    });
    
    it('should create embedded items with auto-generated id', function(done) {
      Person.create({ name: 'Wilma' }, function(err, p) {
        p.addressList.create({ street: 'Home Street 1' }, function(err, address) {
          should.not.exist(err);
          address.id.should.match(/^[0-9a-fA-F]{24}$/);
          address.street.should.equal('Home Street 1');
          done();
        });
      });
    });
    
  });
  
  describe('embedsMany - persisted model', function () {
    
    var address0, address1, address2;
    var person;
    
    // This test spefically uses the Memory connector
    // in order to test the use of the auto-generated
    // id, in the sequence of the related model.
    
    before(function (done) {
      db = getMemoryDataSource();
      Person = db.define('Person', {name: String});
      Address = db.define('Address', {street: String});
      Address.validatesPresenceOf('street');

      db.automigrate(function () {
        Person.destroyAll(done);
      });
    });

    it('can be declared', function (done) {
      // to save related model itself, set
      // persistent: true
      Person.embedsMany(Address, {
        scope: {order: 'street'}, 
        options: {persistent: true}
      });
      db.automigrate(done);
    });
    
    it('should create individual items (0)', function(done) {
      Address.create({ street: 'Street 0' }, function(err, inst) {
        inst.id.should.equal(1); // offset sequence
        address0 = inst;
        done();
      });
    });
    
    it('should create individual items (1)', function(done) {
      Address.create({ street: 'Street 1' }, function(err, inst) {
        inst.id.should.equal(2);
        address1 = inst;
        done();
      });
    });
    
    it('should create individual items (2)', function(done) {
      Address.create({ street: 'Street 2' }, function(err, inst) {
        inst.id.should.equal(3);
        address2 = inst;
        done();
      });
    });
    
    it('should create individual items (3)', function(done) {
      Address.create({ street: 'Street 3' }, function(err, inst) {
        inst.id.should.equal(4); // offset sequence
        done();
      });
    });
    
    it('should add embedded items on scope', function(done) {
      Person.create({ name: 'Fred' }, function(err, p) {
        person = p;
        p.addressList.create(address1.toObject(), function(err, address) {
          should.not.exist(err);
          address.id.should.eql(2);
          address.street.should.equal('Street 1');
          p.addressList.create(address2.toObject(), function(err, address) {
            should.not.exist(err);
            address.id.should.eql(3);
            address.street.should.equal('Street 2');
            done();
          });
        });
      });
    });
    
    it('should create embedded items on scope', function(done) {
      Person.findById(person.id, function(err, p) {
        p.addressList.create({ street: 'Street 4' }, function(err, address) {
          should.not.exist(err);
          address.id.should.equal(5); // in Address sequence, correct offset
          address.street.should.equal('Street 4');
          done();
        });
      });
    });
    
    it('should have embedded items on scope', function(done) {
      Person.findById(person.id, function(err, p) {
        p.addressList(function(err, addresses) {
          should.not.exist(err);
          addresses.should.have.length(3);
          addresses[0].street.should.equal('Street 1');
          addresses[1].street.should.equal('Street 2');
          addresses[2].street.should.equal('Street 4');
          done();
        });
      });
    });
    
    it('should validate embedded items on scope - id', function(done) {
      Person.create({ name: 'Wilma' }, function(err, p) {
        p.addressList.create({ id: null, street: 'Street 1' }, function(err, address) {
          should.not.exist(err);
          address.street.should.equal('Street 1');
          done();
        });
      });
    });
    
    it('should validate embedded items on scope - street', function(done) {
      Person.create({ name: 'Wilma' }, function(err, p) {
        p.addressList.create({ id: 1234 }, function(err, address) {
          should.exist(err);
          err.name.should.equal('ValidationError');
          err.details.codes.street.should.eql(['presence']);
          var expected = 'The `Address` instance is not valid. ';
          expected += 'Details: `street` can\'t be blank.';
          err.message.should.equal(expected);
          done();
        });
      });
    });
    
  });
  
  describe('embedsMany - relations, scope and properties', function () {
    
    var category, job1, job2, job3;
    
    before(function () {
      db = getSchema();
      Category = db.define('Category', {name: String});
      Job = db.define('Job', {name: String});
      Link = db.define('Link', {name: String, notes: String});
    });
    
    it('can be declared', function (done) {
      Category.embedsMany(Link, { 
        as: 'items', // rename
        scope: { include: 'job' }, // always include
        options: { belongsTo: 'job' } // optional, for add()/remove()
      });
      Link.belongsTo(Job, { 
        foreignKey: 'id', // re-use the actual job id
        properties: { id: 'id', name: 'name' }, // denormalize, transfer id
        options: { invertProperties: true }
      });
      db.automigrate(function() {
        Job.create({ name: 'Job 0' }, done); // offset ids for tests
      });
    });
    
    it('should setup related items', function(done) {
      Job.create({ name: 'Job 1' }, function(err, p) {
        job1 = p;
        Job.create({ name: 'Job 2' }, function(err, p) {
          job2 = p;
          Job.create({ name: 'Job 3' }, function(err, p) {
            job3 = p;
            done();
          });
        });
      });
    });
    
    it('should associate items on scope', function(done) {
      Category.create({ name: 'Category A' }, function(err, cat) {
        var link = cat.items.build();
        link.job(job1);
        var link = cat.items.build();
        link.job(job2);
        cat.save(function(err, cat) {
          var job = cat.items.at(0);
          job.should.be.instanceof(Link);
          job.should.not.have.property('jobId');
          job.id.should.eql(job1.id);
          job.name.should.equal(job1.name);
          var job = cat.items.at(1);
          job.id.should.eql(job2.id);
          job.name.should.equal(job2.name);
          done();
        });
      });
    });
    
    it('should include related items on scope', function(done) {
      Category.findOne(function(err, cat) {
        cat.links.should.have.length(2);
        
        // denormalized properties:
        cat.items.at(0).should.be.instanceof(Link);
        cat.items.at(0).id.should.eql(job1.id);
        cat.items.at(0).name.should.equal(job1.name);
        cat.items.at(1).id.should.eql(job2.id);
        cat.items.at(1).name.should.equal(job2.name);
        
        // lazy-loaded relations
        should.not.exist(cat.items.at(0).job());
        should.not.exist(cat.items.at(1).job());
        
        cat.items(function(err, items) {
          cat.items.at(0).job().should.be.instanceof(Job);
          cat.items.at(1).job().should.be.instanceof(Job);
          cat.items.at(1).job().name.should.equal('Job 2');
          done();
        });
      });
    });
    
    it('should remove embedded items by id', function(done) {
      Category.findOne(function(err, cat) {
        cat.links.should.have.length(2);
        cat.items.destroy(job1.id, function(err) {
          should.not.exist(err);
          cat.links.should.have.length(1);
          done();
        });
      });
    });
    
    it('should find items on scope', function(done) {
      Category.findOne(function(err, cat) {
        cat.links.should.have.length(1);
        cat.items.at(0).id.should.eql(job2.id);
        cat.items.at(0).name.should.equal(job2.name);
        
        // lazy-loaded relations
        should.not.exist(cat.items.at(0).job());
        
        cat.items(function(err, items) {
          cat.items.at(0).job().should.be.instanceof(Job);
          cat.items.at(0).job().name.should.equal('Job 2');
          done();
        });
      });
    });
    
    it('should add related items to scope', function(done) {
      Category.findOne(function(err, cat) {
        cat.links.should.have.length(1);
        cat.items.add(job3, function(err, link) {
          link.should.be.instanceof(Link);
          link.id.should.eql(job3.id);
          link.name.should.equal('Job 3');
          
          cat.links.should.have.length(2);
          done();
        });
      });
    });
    
    it('should find items on scope', function(done) {
      Category.findOne(function(err, cat) {
        cat.links.should.have.length(2);
        
        cat.items.at(0).should.be.instanceof(Link);
        cat.items.at(0).id.should.eql(job2.id);
        cat.items.at(0).name.should.equal(job2.name);
        cat.items.at(1).id.should.eql(job3.id);
        cat.items.at(1).name.should.equal(job3.name);
        
        done();
      });
    });
    
    it('should remove embedded items by reference id', function(done) {
      Category.findOne(function(err, cat) {
        cat.links.should.have.length(2);
        cat.items.remove(job2.id, function(err) {
          should.not.exist(err);
          cat.links.should.have.length(1);
          done();
        });
      });
    });
    
    it('should have removed embedded items by reference id', function(done) {
      Category.findOne(function(err, cat) {
        cat.links.should.have.length(1);
        done();
      });
    });

    var jobId;

    it('should create items on scope', function(done) {
      Category.create({ name: 'Category B' }, function(err, cat) {
        category = cat;
        var link = cat.items.build({ notes: 'Some notes...' });
        link.job.create({ name: 'Job 1' }, function(err, p) {
          jobId = p.id;
          cat.links[0].id.should.eql(p.id);
          cat.links[0].name.should.equal('Job 1'); // denormalized
          cat.links[0].notes.should.equal('Some notes...');
          cat.items.at(0).should.equal(cat.links[0]);
          done();
        });
      });
    });
    
    it('should find items on scope', function(done) {
      Category.findById(category.id, function(err, cat) {
        cat.name.should.equal('Category B');
        cat.links.toObject().should.eql([
          {id: jobId, name: 'Job 1', notes: 'Some notes...'}
        ]);
        cat.items.at(0).should.equal(cat.links[0]);
        cat.items(function(err, items) { // alternative access
          items.should.be.an.array;
          items.should.have.length(1);
          items[0].job(function(err, p) {
            p.name.should.equal('Job 1'); // actual value
            done();
          });
        });
      });
    });
    
    it('should update items on scope - and save parent', function(done) {
      Category.findById(category.id, function(err, cat) {
        var link = cat.items.at(0);
        link.updateAttributes({notes: 'Updated notes...'}, function(err, link) {
          link.notes.should.equal('Updated notes...');
          done();
        });
      });
    });
    
    it('should find items on scope - verify update', function(done) {
      Category.findById(category.id, function(err, cat) {
        cat.name.should.equal('Category B');
        cat.links.toObject().should.eql([
          {id: jobId, name: 'Job 1', notes: 'Updated notes...'}
        ]);
        done();
      });
    });
    
    it('should remove items from scope - and save parent', function(done) {
      Category.findById(category.id, function(err, cat) {
        cat.items.at(0).destroy(function(err, link) {
          cat.links.should.eql([]);
          done();
        });
      });
    });
    
    it('should find items on scope - verify destroy', function(done) {
      Category.findById(category.id, function(err, cat) {
        cat.name.should.equal('Category B');
        cat.links.should.eql([]);
        done();
      });
    });
    
  });
  
  describe('embedsMany - polymorphic relations', function () {
    
    var person1, person2;
    
    before(function (done) {
      db = getSchema();
      tmp = getTransientDataSource();
      
      Book = db.define('Book', {name: String});
      Author = db.define('Author', {name: String});
      Reader = db.define('Reader', {name: String});
      
      Link = tmp.define('Link', {
        id: {type: Number, id: true},
        name: String, notes: String
      }); // generic model
      Link.validatesPresenceOf('linkedId');
      Link.validatesPresenceOf('linkedType');

      db.automigrate(function () {
        Book.destroyAll(function() {
          Author.destroyAll(function() {
            Reader.destroyAll(done);
          });
        });
      });
    });

    it('can be declared', function (done) {
      var idType = db.connector.getDefaultIdType();
      
      Book.embedsMany(Link, { as: 'people',
        polymorphic: 'linked',
        scope: { include: 'linked' }
      });      
      Link.belongsTo('linked', {
        polymorphic: { idType: idType },  // native type
        properties: { name: 'name' },     // denormalized
        options: { invertProperties: true }
      });
      db.automigrate(done);
    });
    
    it('should setup related items', function(done) {
      Author.create({ name: 'Author 1' }, function(err, p) {
        person1 = p;
        Reader.create({ name: 'Reader 1' }, function(err, p) {
          person2 = p;
          done();
        });
      });
    });
    
    it('should create items on scope', function(done) {
      Book.create({ name: 'Book' }, function(err, book) {
        var link = book.people.build({ notes: 'Something ...' });
        link.linked(person1);
        var link = book.people.build();
        link.linked(person2);
        book.save(function(err, book) {
          should.not.exist(err);
          
          var link = book.people.at(0);
          link.should.be.instanceof(Link);
          link.id.should.equal(1);
          link.linkedId.should.eql(person1.id);
          link.linkedType.should.equal('Author');
          link.name.should.equal('Author 1');
          
          var link = book.people.at(1);
          link.should.be.instanceof(Link);
          link.id.should.equal(2);
          link.linkedId.should.eql(person2.id);
          link.linkedType.should.equal('Reader');
          link.name.should.equal('Reader 1');
          
          done();
        });
      });
    });
    
    it('should include related items on scope', function(done) {
      Book.findOne(function(err, book) {
        book.links.should.have.length(2);
        
        var link = book.people.at(0);
        link.should.be.instanceof(Link);
        link.id.should.equal(1);
        link.linkedId.should.eql(person1.id);
        link.linkedType.should.equal('Author');
        link.notes.should.equal('Something ...');
        
        var link = book.people.at(1);
        link.should.be.instanceof(Link);
        link.id.should.equal(2);
        link.linkedId.should.eql(person2.id);
        link.linkedType.should.equal('Reader');
        
        // lazy-loaded relations
        should.not.exist(book.people.at(0).linked());
        should.not.exist(book.people.at(1).linked());
        
        book.people(function(err, people) {
          people[0].linked().should.be.instanceof(Author);
          people[0].linked().name.should.equal('Author 1');
          people[1].linked().should.be.instanceof(Reader);
          people[1].linked().name.should.equal('Reader 1');
          done();
        });
      });
    });
    
    it('should include nested related items on scope', function(done) {
      
      // There's some date duplication going on, so it might
      // make sense to override toObject on a case-by-case basis
      // to sort this out (delete links, keep people).
      // In loopback, an afterRemote filter could do this as well.
      
      Book.find({ include: 'people' }, function(err, books) {
        var obj = books[0].toObject();
        
        obj.should.have.property('links');
        obj.should.have.property('people');
        
        obj.links.should.have.length(2);
        obj.links[0].name.should.equal('Author 1');
        obj.links[1].name.should.equal('Reader 1');
        
        obj.people.should.have.length(2);
        
        obj.people[0].name.should.equal('Author 1');
        obj.people[0].notes.should.equal('Something ...');
        
        obj.people[0].linked.name.should.equal('Author 1');
        obj.people[1].linked.name.should.equal('Reader 1');
        
        done();
      });
    });
    
  });
  
  describe('referencesMany', function () {
    
    var job1, job2, job3;
    
    before(function (done) {
      db = getSchema();
      Category = db.define('Category', {name: String});
      Job = db.define('Job', {name: String});
      
      db.automigrate(function () {
        Category.destroyAll(function() {
          Job.destroyAll(done);
        });
      });
    });

    it('can be declared', function (done) {
      var reverse = function(cb) {
        var modelInstance = this.modelInstance;
        var fk = this.definition.keyFrom;
        var ids = modelInstance[fk] || [];
        modelInstance.updateAttribute(fk, ids.reverse(), function(err, inst) {
          cb(err, inst[fk] || []);
        });
      };
      
      reverse.shared = true; // remoting
      reverse.http = { verb: 'put', path: '/jobs/reverse' };
      
      Category.referencesMany(Job, { scopeMethods: {
        reverse: reverse
      } });
      
      Category.prototype['__reverse__jobs'].should.be.a.function;
      should.exist(Category.prototype['__reverse__jobs'].shared);
      Category.prototype['__reverse__jobs'].http.should.eql(reverse.http);
      
      db.automigrate(done);
    });
    
    it('should setup test records', function (done) {
      Job.create({ name: 'Job 1' }, function(err, p) {
        job1 = p;
        Job.create({ name: 'Job 3' }, function(err, p) {
          job3 = p;
          done();
        });
      });
    });
    
    it('should create record on scope', function (done) {
      Category.create({ name: 'Category A' }, function(err, cat) {
        cat.jobIds.should.be.an.array;
        cat.jobIds.should.have.length(0);
        cat.jobs.create({ name: 'Job 2' }, function(err, p) {
          should.not.exist(err);
          cat.jobIds.should.have.length(1);
          cat.jobIds.should.eql([p.id]);
          p.name.should.equal('Job 2');
          job2 = p;
          done();
        });
      });
    });
    
    it('should not allow duplicate record on scope', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobIds = [job2.id, job2.id];
        cat.save(function(err, p) {
          should.exist(err);
          err.name.should.equal('ValidationError');
          err.details.codes.jobs.should.eql(['uniqueness']);
          var expected = 'The `Category` instance is not valid. ';
          expected += 'Details: `jobs` contains duplicate `Job` instance.';
          err.message.should.equal(expected);
          done();
        });
      });
    });
    
    it('should find items on scope', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobIds.should.eql([job2.id]);
        cat.jobs(function(err, jobs) {
          should.not.exist(err);
          var p = jobs[0];
          p.id.should.eql(job2.id);
          p.name.should.equal('Job 2');
          done();
        });
      });
    });
    
    it('should find items on scope - findById', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobIds.should.eql([job2.id]);
        cat.jobs.findById(job2.id, function(err, p) {
          should.not.exist(err);
          p.should.be.instanceof(Job);
          p.id.should.eql(job2.id);
          p.name.should.equal('Job 2');
          done();
        });
      });
    });
    
    it('should check if a record exists on scope', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobs.exists(job2.id, function(err, exists) {
          should.not.exist(err);
          should.exist(exists);
          done();
        });
      });
    });
    
    it('should update a record on scope', function (done) {
      Category.findOne(function(err, cat) {
        var attrs = { name: 'Job 2 - edit' };
        cat.jobs.updateById(job2.id, attrs, function(err, p) {
          should.not.exist(err);
          p.name.should.equal(attrs.name);
          done();
        });
      });
    });
    
    it('should get a record by index - at', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobs.at(0, function(err, p) {
          should.not.exist(err);
          p.should.be.instanceof(Job);
          p.id.should.eql(job2.id);
          p.name.should.equal('Job 2 - edit');
          done();
        });
      });
    });
    
    it('should add a record to scope - object', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobs.add(job1, function(err, prod) {
          should.not.exist(err);
          cat.jobIds.should.eql([job2.id, job1.id]);
          prod.id.should.eql(job1.id);
          prod.should.have.property('name');
          done();
        });
      });
    });
    
    it('should add a record to scope - object', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobs.add(job3.id, function(err, prod) {
          should.not.exist(err);
          var expected = [job2.id, job1.id, job3.id];
          cat.jobIds.should.eql(expected);
          prod.id.should.eql(job3.id);
          prod.should.have.property('name');
          done();
        });
      });
    });
    
    it('should find items on scope - findById', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobs.findById(job3.id, function(err, p) {
          should.not.exist(err);
          p.id.should.eql(job3.id);
          p.name.should.equal('Job 3');
          done();
        });
      });
    });
    
    it('should find items on scope - filter', function (done) {
      Category.findOne(function(err, cat) {
        var filter = { where: { name: 'Job 1' } };
        cat.jobs(filter, function(err, jobs) {
          should.not.exist(err);
          jobs.should.have.length(1);
          var p = jobs[0];
          p.id.should.eql(job1.id);
          p.name.should.equal('Job 1');
          done();
        });
      });
    });
    
    it('should remove items from scope', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobs.remove(job1.id, function(err, ids) {
          should.not.exist(err);
          var expected = [job2.id, job3.id];
          cat.jobIds.should.eql(expected);
          ids.should.eql(cat.jobIds);
          done();
        });
      });
    });
    
    it('should find items on scope - verify', function (done) {
      Category.findOne(function(err, cat) {
        var expected = [job2.id, job3.id];
        cat.jobIds.should.eql(expected);
        cat.jobs(function(err, jobs) {
          should.not.exist(err);
          jobs.should.have.length(2);
          jobs[0].id.should.eql(job2.id);
          jobs[1].id.should.eql(job3.id);
          done();
        });
      });
    });
    
    it('should allow custom scope methods - reverse', function(done) {
      Category.findOne(function(err, cat) {
        cat.jobs.reverse(function(err, ids) {
          var expected = [job3.id, job2.id];
          ids.should.eql(expected);
          cat.jobIds.should.eql(expected);
          done();
        });
      })
    });
    
    it('should include related items from scope', function(done) {
      Category.find({ include: 'jobs' }, function(err, categories) {
        categories.should.have.length(1);
        var cat = categories[0].toObject();
        cat.name.should.equal('Category A');
        cat.jobs.should.have.length(2);
        cat.jobs[0].id.should.eql(job3.id);
        cat.jobs[1].id.should.eql(job2.id);
        done();
      });
    });
    
    it('should destroy items from scope - destroyById', function (done) {
      Category.findOne(function(err, cat) {
        cat.jobs.destroy(job2.id, function(err) {
          should.not.exist(err);
          var expected = [job3.id];
          cat.jobIds.should.eql(expected);
          Job.exists(job2.id, function(err, exists) {
            should.not.exist(err);
            should.exist(exists);
            done();
          });
        });
      });
    });
    
    it('should find items on scope - verify', function (done) {
      Category.findOne(function(err, cat) {
        var expected = [job3.id];
        cat.jobIds.should.eql(expected);
        cat.jobs(function(err, jobs) {
          should.not.exist(err);
          jobs.should.have.length(1);
          jobs[0].id.should.eql(job3.id);
          done();
        });
      });
    });
  
  });
  
  describe('custom relation/scope methods', function () {
    var categoryId;

    before(function (done) {
      db = getSchema();
      Category = db.define('Category', {name: String});
      Job = db.define('Job', {name: String});
      
      db.automigrate(function () {
        Category.destroyAll(function() {
          Job.destroyAll(done);
        });
      });
    });

    it('can be declared', function (done) {
      var relation = Category.hasMany(Job);
      
      var summarize = function(cb) {
        var modelInstance = this.modelInstance;
        this.fetch(function(err, items) {
          if (err) return cb(err, []);
          var summary = items.map(function(item) {
            var obj = item.toObject();
            obj.categoryName = modelInstance.name;
            return obj;
          });
          cb(null, summary);
        });
      };
      
      summarize.shared = true; // remoting
      summarize.http = { verb: 'get', path: '/jobs/summary' };
      
      relation.defineMethod('summarize', summarize);
      
      Category.prototype['__summarize__jobs'].should.be.a.function;
      should.exist(Category.prototype['__summarize__jobs'].shared);
      Category.prototype['__summarize__jobs'].http.should.eql(summarize.http);
      
      db.automigrate(done);
    });
    
    it('should setup test records', function (done) {
      Category.create({ name: 'Category A' }, function(err, cat) {
        categoryId = cat.id;
        cat.jobs.create({ name: 'Job 1' }, function(err, p) {
          cat.jobs.create({ name: 'Job 2' }, function(err, p) {
            done();
          });
        })
      });
    });
    
    it('should allow custom scope methods - summarize', function(done) {
      var expected = [
        { name: 'Job 1', categoryId: categoryId, categoryName: 'Category A' },
        { name: 'Job 2', categoryId: categoryId, categoryName: 'Category A' }
      ];
      
      Category.findOne(function(err, cat) {
        cat.jobs.summarize(function(err, summary) {
          should.not.exist(err);
          var result = summary.map(function(item) {
            delete item.id;
            return item;
          });
          result.should.eql(expected);
          done();
        });
      })
    });
    
  });

});
