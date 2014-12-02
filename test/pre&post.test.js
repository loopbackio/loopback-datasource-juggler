// This test written in mocha+should.js
var should = require('./init.js');

var j = require('../'),
  Schema = j.Schema,
  AbstractClass = j.AbstractClass,
  Hookable = j.Hookable,

  db, User;

describe('hooks', function () {

  before(function (done) {
    db = getSchema();

    User = db.define('User', {
      email: {type: String, index: true},
      name: String,
      password: String,
      state: String,
      inc: {type: Number, default: 0}
    });

    db.automigrate(done);
  });

  //describe('_initialize', function () {
  //  var triggerByInitialize = false;
  //  beforeEach(function () {
  //    User.post('_initialize', function (next, data) {
  //      triggerByInitialize = true;
  //      if (data.name === 'Nickolay') {
  //        data.name += ' Rozental';
  //      }
  //      next();
  //    });
  //  });
  //
  //  it('should be triggered on new', function (done) {
  //    new User;
  //    triggerByInitialize.should.equal(true);
  //  });
  //
  //  it('should be triggered on create', function (done) {
  //    var user;
  //
  //    User.create({name: 'Nickolay'}, function (err, u) {
  //      u.id.should.be.ok;
  //      u.name.should.equal('Nickolay Rozental');
  //      done();
  //    });
  //  });
  //
  //});

  describe('_create', function () {
    var call_by_post_create = false;
    before(function () {
      var pre_create = function (next, data) {
        data.inc += 1;
        next();
      };
      User.pre('_create', pre_create)
        .pre('_create', pre_create)
        .post('_create', function (next) {
          call_by_post_create = true;
          next();
        })
    });
    after(function () {
      User.removePre('_create');
    });
    it('should be triggered on create', function (done) {
      User.create(function (err, u) {
        u.inc.should.equal(2);
        call_by_post_create.should.equal(true);
        done();
      });
    });

    it('should be triggered on new+save', function (done) {
      (new User).save(function (err, u) {
        u.inc.should.equal(2);
        done();
      });
    });

    it('should be trigger post hook', function (done) {
      User.create(function (err, u) {
        call_by_post_create.should.equal(true);
        done();
      });
    });
  });

  describe('_save', function () {
    var call_by_post_save = false;
    before(function (done) {
      var pre_save = function (next, data) {
        data.inc += 1;
        next();
      };
      User.pre('_save', pre_save)
        .pre('_save', pre_save)
        .post('_save', function (next) {
          call_by_post_save = true;
          next();
        });
      done();
    });
    after(function () {
      User.removePre('_save');
    });

    it('should be triggered on new+save', function (done) {
      (new User).save(function (err, u) {
        u.inc.should.equal(2);
        done();
      });
    });
  });

  describe('update', function () {
    before(function (done) {
      User.pre('_update', function (next,data) {
        data.name+=' Nickolay';
        next();
      });
      done();
    });
    it('should be triggered on updateAttributes', function (done) {
      User.create(function (err, user) {
        user.updateAttributes({name: 'Anatoliy'}, function (err,newUser) {
          newUser.name.should.equal('Anatoliy Nickolay');
          done();
        });
      });
    });
  });

  describe('_destroy', function () {
    var hook = 'not called';
    before(function (done) {
      User.pre('_destroy', function (next) {
        hook = 'called';
        next();
      });
      done();
    });

    it('should be triggered on destroy', function (done) {
      User.create(function (err, user) {
        user.destroy(function (err) {
          hook.should.equal('called');
          done();
        });
      });
    });

  });

});
