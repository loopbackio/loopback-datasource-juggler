// This test written in mocha+should.js
var should = require('./init.js');

var db, Book, Chapter, Author, Reader, Publisher;

describe('relations', function () {
  before(function (done) {
    db = getSchema();
    Book = db.define('Book', {name: String});
    Chapter = db.define('Chapter', {name: {type: String, index: true}});
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

  after(function () {
    // db.disconnect();
  });

  describe('hasMany', function () {
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

    it('should fetch all scoped instances', function (done) {
      Book.create(function (err, book) {
        book.chapters.create({name: 'a'}, function () {
          book.chapters.create({name: 'z'}, function () {
            book.chapters.create({name: 'c'}, function () {
              fetch(book);
            });
          });
        });
      });
      function fetch(book) {
        book.chapters(function (err, ch) {
          should.not.exist(err);
          should.exist(ch);
          ch.should.have.lengthOf(3);

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
              fetch(book);
            });
          });
        });
      });

      function fetch(book) {
        book.chapters.findById(id, function (err, ch) {
          should.not.exist(err);
          should.exist(ch);
          ch.id.should.equal(id);
          done();
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
            fetch(book);
          });
        });
      });

      function fetch(book) {
        book.chapters.findById(id, function (err, ch) {
          should.not.exist(err);
          should.exist(ch);
          ch.id.should.equal(id);
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
            fetch(book);
          });
        });
      });

      function fetch(book) {
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
              fetch(book);
            });
          });
        });
      });

      function fetch(book) {
        book.chapters.exists(id, function (err, flag) {
          should.not.exist(err);
          flag.should.be.eql(true);
          done();
        });
      }
    });
  });

  describe('hasMany through', function () {
    var Physician, Patient, Appointment;

    before(function (done) {
      db = getSchema();
      Physician = db.define('Physician', {name: String});
      Patient = db.define('Patient', {name: String});
      Appointment = db.define('Appointment', {date: {type: Date,
        default: function () {
          return new Date();
        }}});

      Physician.hasMany(Patient, {through: Appointment});
      Patient.hasMany(Physician, {through: Appointment});
      Appointment.belongsTo(Patient);
      Appointment.belongsTo(Physician);

      db.automigrate(['Physician', 'Patient', 'Appointment'], function (err) {
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

    it('should fetch all scoped instances', function (done) {
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function () {
          physician.patients.create({name: 'z'}, function () {
            physician.patients.create({name: 'c'}, function () {
              fetch(physician);
            });
          });
        });
      });
      function fetch(physician) {
        physician.patients(function (err, ch) {
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
              fetch(physician);
            });
          });
        });
      });

      function fetch(physician) {
        physician.patients.findById(id, function (err, ch) {
          should.not.exist(err);
          should.exist(ch);
          ch.id.should.equal(id);
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
            fetch(physician);
          });
        });
      });

      function fetch(physician) {
        physician.patients.findById(id, function (err, ch) {
          should.not.exist(err);
          should.exist(ch);
          ch.id.should.equal(id);
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
            fetch(physician);
          });
        });
      });

      function fetch(physician) {
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
          id = ch.id;
          physician.patients.create({name: 'z'}, function () {
            physician.patients.create({name: 'c'}, function () {
              fetch(physician);
            });
          });
        });
      });

      function fetch(physician) {
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

    it('should allow to remove connection with instance', function (done) {
      var id;
      Physician.create(function (err, physician) {
        physician.patients.create({name: 'a'}, function (err, patient) {
          id = patient.id;
          physician.patients.remove(id, function (err, ch) {
            fetch(physician);
          });
        });
      });

      function fetch(physician) {
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

  describe('belongsTo', function () {
    var List, Item, Fear, Mind;

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
        List.create(function (e, list) {
          should.not.exist(e);
          should.exist(list);
          list.todos.create(function (err, todo) {
            todo.list(function (e, l) {
              should.not.exist(e);
              should.exist(l);
              l.should.be.an.instanceOf(List);
              todo.list().id.should.equal(l.id);
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

  });

  describe('hasOne', function () {
    var Supplier, Account;

    before(function () {
      db = getSchema();
      Supplier = db.define('Supplier', {name: String});
      Account = db.define('Account', {accountNo: String});
    });

    it('can be declared using hasOne method', function () {
      Supplier.hasOne(Account);
      Object.keys((new Account()).toObject()).should.include('supplierId');
      (new Supplier()).account.should.be.an.instanceOf(Function);
    });

    it('can be used to query data', function (done) {
      // Supplier.hasOne(Account);
      db.automigrate(function () {
        Supplier.create({name: 'Supplier 1'}, function (e, supplier) {
          should.not.exist(e);
          should.exist(supplier);
          supplier.account.create({accountNo: 'a01'}, function (err, account) {
            supplier.account(function (e, act) {
              should.not.exist(e);
              should.exist(act);
              act.should.be.an.instanceOf(Account);
              supplier.account().id.should.equal(act.id);
              done();
            });
          });
        });
      });
    });

  });

  describe('hasAndBelongsToMany', function () {
    var Article, Tag, ArticleTag;
    it('can be declared', function (done) {
      Article = db.define('Article', {title: String});
      Tag = db.define('Tag', {name: String});
      Article.hasAndBelongsToMany('tags');
      ArticleTag = db.models.ArticleTag;
      db.automigrate(function () {
        Article.destroyAll(function () {
          Tag.destroyAll(function () {
            ArticleTag.destroyAll(done)
          });
        });
      });
    });

    it('should allow to create instances on scope', function (done) {
      Article.create(function (e, article) {
        article.tags.create({name: 'popular'}, function (e, t) {
          t.should.be.an.instanceOf(Tag);
          // console.log(t);
          ArticleTag.findOne(function (e, at) {
            should.exist(at);
            at.tagId.toString().should.equal(t.id.toString());
            at.articleId.toString().should.equal(article.id.toString());
            done();
          });
        });
      });
    });

    it('should allow to fetch scoped instances', function (done) {
      Article.findOne(function (e, article) {
        article.tags(function (e, tags) {
          should.not.exist(e);
          should.exist(tags);
          done();
        });
      });
    });

    it('should allow to add connection with instance', function (done) {
      Article.findOne(function (e, article) {
        Tag.create({name: 'awesome'}, function (e, tag) {
          article.tags.add(tag, function (e, at) {
            should.not.exist(e);
            should.exist(at);
            at.should.be.an.instanceOf(ArticleTag);
            at.tagId.should.equal(tag.id);
            at.articleId.should.equal(article.id);
            done();
          });
        });
      });
    });

    it('should allow to remove connection with instance', function (done) {
      Article.findOne(function (e, article) {
        article.tags(function (e, tags) {
          var len = tags.length;
          tags.should.not.be.empty;
          article.tags.remove(tags[0], function (e) {
            should.not.exist(e);
            article.tags(true, function (e, tags) {
              tags.should.have.lengthOf(len - 1);
              done();
            });
          });
        });
      });
    });

    it('should set targetClass on scope property', function() {
      should.equal(Article.prototype.tags._targetClass, 'Tag');
    });
  });

});
