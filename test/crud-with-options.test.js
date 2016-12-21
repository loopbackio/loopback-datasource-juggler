// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
var should = require('./init.js');
var async = require('async');
var db, User, options, filter;

describe('crud-with-options', function() {
  before(function(done) {
    db = getSchema();
    User = db.define('User', {
      id: {type: Number, id: true},
      seq: {type: Number, index: true},
      name: {type: String, index: true, sort: true},
      email: {type: String, index: true},
      birthday: {type: Date, index: true},
      role: {type: String, index: true},
      order: {type: Number, index: true, sort: true},
      vip: {type: Boolean},
    });
    options = {};
    filter = {fields: ['name', 'id']};

    db.automigrate(['User'], done);
  });

  describe('findById', function() {
    before(function(done) {
      User.destroyAll(done);
    });

    it('should allow findById(id, options, cb)', function(done) {
      User.findById(1, options, function(err, u) {
        should.not.exist(u);
        should.not.exist(err);
        done();
      });
    });

    it('should allow findById(id, filter, cb)', function(done) {
      User.findById(1, filter, function(err, u) {
        should.not.exist(u);
        should.not.exist(err);
        done();
      });
    });

    it('should allow findById(id)', function() {
      User.findById(1);
    });

    it('should allow findById(id, filter)', function() {
      User.findById(1, filter);
    });

    it('should allow findById(id, options)', function() {
      User.findById(1, options);
    });

    it('should allow findById(id, filter, options)', function() {
      User.findById(1, filter, options);
    });

    it('should throw when invalid filter are provided for findById',
      function(done) {
        (function() {
          User.findById(1, '123', function(err, u) {
          });
        }).should.throw('The filter argument must be an object');
        done();
      });

    it('should throw when invalid options are provided for findById',
      function(done) {
        (function() {
          User.findById(1, filter, '123', function(err, u) {
          });
        }).should.throw('The options argument must be an object');
        done();
      });

    it('should report an invalid id via callback for findById',
      function(done) {
        User.findById(undefined, {}, function(err, u) {
          err.should.be.eql(
            new Error('Model::findById requires the id argument'));
          done();
        });
      });

    it('should allow findById(id, filter, cb) for a matching id',
      function(done) {
        User.create({name: 'x', email: 'x@y.com'}, function(err, u) {
          should.not.exist(err);
          should.exist(u.id);
          User.findById(u.id, filter, function(err, u) {
            should.exist(u);
            should.not.exist(err);
            u.should.be.an.instanceOf(User);
            u.should.have.property('name', 'x');
            u.should.have.property('email', undefined);
            done();
          });
        });
      });

    it('should allow findById(id, options, cb) for a matching id',
      function(done) {
        User.create({name: 'y', email: 'y@y.com'}, function(err, u) {
          should.not.exist(err);
          should.exist(u.id);
          User.findById(u.id, options, function(err, u) {
            should.exist(u);
            should.not.exist(err);
            u.should.be.an.instanceOf(User);
            u.should.have.property('name', 'y');
            u.should.have.property('email', 'y@y.com');
            done();
          });
        });
      });

    it('should allow findById(id, filter, options, cb) for a matching id',
      function(done) {
        User.create({name: 'z', email: 'z@y.com'}, function(err, u) {
          should.not.exist(err);
          should.exist(u.id);
          User.findById(u.id, filter, options, function(err, u) {
            should.exist(u);
            should.not.exist(err);
            u.should.be.an.instanceOf(User);
            u.should.have.property('name', 'z');
            u.should.have.property('email', undefined);
            done();
          });
        });
      });

    it('should allow promise-style findById',
      function(done) {
        User.create({name: 'w', email: 'w@y.com'}).then(function(u) {
          should.exist(u.id);
          return User.findById(u.id).then(function(u) {
            should.exist(u);
            u.should.be.an.instanceOf(User);
            u.should.have.property('name', 'w');
            u.should.have.property('email', 'w@y.com');
            return u;
          });
        }).then(function(u) {
          should.exist(u);
          should.exist(u.id);
          return User.findById(u.id, filter).then(function(u) {
            should.exist(u);
            u.should.be.an.instanceOf(User);
            u.should.have.property('name', 'w');
            u.should.have.property('email', undefined);
            return u;
          });
        }).then(function(u) {
          should.exist(u);
          should.exist(u.id);
          return User.findById(u.id, options).then(function(u) {
            should.exist(u);
            u.should.be.an.instanceOf(User);
            u.should.have.property('name', 'w');
            u.should.have.property('email', 'w@y.com');
            return u;
          });
        }).then(function(u) {
          should.exist(u);
          should.exist(u.id);
          return User.findById(u.id, filter, options).then(function(u) {
            should.exist(u);
            u.should.be.an.instanceOf(User);
            u.should.have.property('name', 'w');
            u.should.have.property('email', undefined);
            done();
          });
        }).catch(function(err) {
          done(err);
        });
      });
  });

  describe('findByIds', function() {
    before(function(done) {
      var people = [
        {id: 1, name: 'a', vip: true},
        {id: 2, name: 'b'},
        {id: 3, name: 'c'},
        {id: 4, name: 'd', vip: true},
        {id: 5, name: 'e'},
        {id: 6, name: 'f'},
      ];
      // Use automigrate so that serial keys are 1-6
      db.automigrate(['User'], function(err) {
        User.create(people, options, function(err, users) {
          done();
        });
      });
    });

    it('should allow findByIds(ids, cb)', function(done) {
      User.findByIds([3, 2, 1], function(err, users) {
        should.exist(users);
        should.not.exist(err);
        var names = users.map(function(u) { return u.name; });
        names.should.eql(['c', 'b', 'a']);
        done();
      });
    });

    it('should allow findByIds(ids, filter, options, cb)',
      function(done) {
        User.findByIds([4, 3, 2, 1],
          {where: {vip: true}}, options, function(err, users) {
            should.exist(users);
            should.not.exist(err);
            var names = users.map(function(u) {
              return u.name;
            });
            names.should.eql(['d', 'a']);
            done();
          });
      });
  });

  describe('find', function() {
    before(seed);

    it('should allow find(cb)', function(done) {
      User.find(function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(6);
        done();
      });
    });

    it('should allow find(filter, cb)', function(done) {
      User.find({limit: 3}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(3);
        done();
      });
    });

    it('should allow find(filter, options, cb)', function(done) {
      User.find({}, options, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(6);
        done();
      });
    });

    it('should allow find(filter, options)', function() {
      User.find({limit: 3}, options);
    });

    it('should allow find(filter)', function() {
      User.find({limit: 3});
    });

    it('should skip trailing undefined args', function(done) {
      User.find({limit: 3}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(3);
        done();
      }, undefined, undefined);
    });

    it('should throw on an invalid query arg', function() {
      (function() {
        User.find('invalid query', function(err, users) {
          // noop
        });
      }).should.throw('The query argument must be an object');
    });

    it('should throw on an invalid options arg', function() {
      (function() {
        User.find({limit: 3}, 'invalid option', function(err, users) {
          // noop
        });
      }).should.throw('The options argument must be an object');
    });

    it('should throw on an invalid cb arg', function() {
      (function() {
        User.find({limit: 3}, {}, 'invalid cb');
      }).should.throw('The cb argument must be a function');
    });
  });

  describe('count', function() {
    before(seed);

    it('should allow count(cb)', function(done) {
      User.count(function(err, n) {
        should.not.exist(err);
        should.exist(n);
        n.should.equal(6);
        done();
      });
    });

    it('should allow count(where, cb)', function(done) {
      User.count({role: 'lead'}, function(err, n) {
        should.not.exist(err);
        should.exist(n);
        n.should.equal(2);
        done();
      });
    });

    it('should allow count(where, options, cb)', function(done) {
      User.count({role: 'lead'}, options, function(err, n) {
        should.not.exist(err);
        should.exist(n);
        n.should.equal(2);
        done();
      });
    });
  });

  describe('findOne', function() {
    before(seed);

    it('should allow findOne(cb)', function(done) {
      User.find({order: 'id'}, function(err, users) {
        User.findOne(function(e, u) {
          should.not.exist(e);
          should.exist(u);
          u.id.toString().should.equal(users[0].id.toString());
          done();
        });
      });
    });

    it('should allow findOne(filter, options, cb)', function(done) {
      User.findOne({order: 'order'}, options, function(e, u) {
        should.not.exist(e);
        should.exist(u);
        u.order.should.equal(1);
        u.name.should.equal('Paul McCartney');
        done();
      });
    });

    it('should allow findOne(filter, cb)', function(done) {
      User.findOne({order: 'order'}, function(e, u) {
        should.not.exist(e);
        should.exist(u);
        u.order.should.equal(1);
        u.name.should.equal('Paul McCartney');
        done();
      });
    });

    it('should allow trailing undefined args', function(done) {
      User.findOne({order: 'order'}, function(e, u) {
        should.not.exist(e);
        should.exist(u);
        u.order.should.equal(1);
        u.name.should.equal('Paul McCartney');
        done();
      }, undefined);
    });
  });

  describe('exists', function() {
    before(seed);

    it('should allow exists(id, cb)', function(done) {
      User.findOne(function(e, u) {
        User.exists(u.id, function(err, exists) {
          should.not.exist(err);
          should.exist(exists);
          exists.should.be.ok;
          done();
        });
      });
    });

    it('should allow exists(id, options, cb)', function(done) {
      User.destroyAll(function() {
        User.exists(42, options, function(err, exists) {
          should.not.exist(err);
          exists.should.not.be.ok;
          done();
        });
      });
    });
  });

  describe('save', function() {
    it('should allow save(options, cb)', function(done) {
      var options = {foo: 'bar'};
      var opts;

      User.observe('after save', function(ctx, next) {
        opts = ctx.options;
        next();
      });

      var u = new User();
      u.save(options, function(err) {
        should.not.exist(err);
        options.should.equal(opts);
        done();
      });
    });
  });

  describe('destroyAll with options', function() {
    beforeEach(seed);

    it('should allow destroyAll(where, options, cb)', function(done) {
      User.destroyAll({name: 'John Lennon'}, options, function(err) {
        should.not.exist(err);
        User.find({where: {name: 'John Lennon'}}, function(err, data) {
          should.not.exist(err);
          data.length.should.equal(0);
          User.find({where: {name: 'Paul McCartney'}}, function(err, data) {
            should.not.exist(err);
            data.length.should.equal(1);
            done();
          });
        });
      });
    });

    it('should allow destroyAll(where, cb)', function(done) {
      User.destroyAll({name: 'John Lennon'}, function(err) {
        should.not.exist(err);
        User.find({where: {name: 'John Lennon'}}, function(err, data) {
          should.not.exist(err);
          data.length.should.equal(0);
          User.find({where: {name: 'Paul McCartney'}}, function(err, data) {
            should.not.exist(err);
            data.length.should.equal(1);
            done();
          });
        });
      });
    });

    it('should allow destroyAll(cb)', function(done) {
      User.destroyAll(function(err) {
        should.not.exist(err);
        User.find({where: {name: 'John Lennon'}}, function(err, data) {
          should.not.exist(err);
          data.length.should.equal(0);
          User.find({where: {name: 'Paul McCartney'}}, function(err, data) {
            should.not.exist(err);
            data.length.should.equal(0);
            done();
          });
        });
      });
    });
  });

  describe('updateAll ', function() {
    beforeEach(seed);

    it('should allow updateAll(where, data, cb)', function(done) {
      User.update({name: 'John Lennon'}, {name: 'John Smith'}, function(err) {
        should.not.exist(err);
        User.find({where: {name: 'John Lennon'}}, function(err, data) {
          should.not.exist(err);
          data.length.should.equal(0);
          User.find({where: {name: 'John Smith'}}, function(err, data) {
            should.not.exist(err);
            data.length.should.equal(1);
            done();
          });
        });
      });
    });

    it('should allow updateAll(where, data, options, cb)', function(done) {
      User.update({name: 'John Lennon'}, {name: 'John Smith'}, options,
        function(err) {
          should.not.exist(err);
          User.find({where: {name: 'John Lennon'}}, function(err, data) {
            should.not.exist(err);
            data.length.should.equal(0);
            User.find({where: {name: 'John Smith'}}, function(err, data) {
              should.not.exist(err);
              data.length.should.equal(1);
              done();
            });
          });
        });
    });

    it('should allow updateAll(data, cb)', function(done) {
      User.update({name: 'John Smith'}, function() {
        User.find({where: {name: 'John Lennon'}}, function(err, data) {
          should.not.exist(err);
          data.length.should.equal(0);
          User.find({where: {name: 'John Smith'}}, function(err, data) {
            should.not.exist(err);
            data.length.should.equal(6);
            done();
          });
        });
      });
    });
  });
});

describe('upsertWithWhere', function() {
  beforeEach(seed);
  it('rejects upsertWithWhere (options,cb)', function(done) {
    try {
      User.upsertWithWhere({}, function(err) {
        if (err) return done(err);
      });
    } catch (ex) {
      ex.message.should.equal('The data argument must be an object');
      done();
    }
  });

  it('rejects upsertWithWhere (cb)', function(done) {
    try {
      User.upsertWithWhere(function(err) {
        if (err) return done(err);
      });
    } catch (ex) {
      ex.message.should.equal('The where argument must be an object');
      done();
    }
  });

  it('allows upsertWithWhere by accepting where,data and cb as arguments', function(done) {
    User.upsertWithWhere({name: 'John Lennon'}, {name: 'John Smith'}, function(err) {
      if (err) return done(err);
      User.find({where: {name: 'John Lennon'}}, function(err, data) {
        if (err) return done(err);
        data.length.should.equal(0);
        User.find({where: {name: 'John Smith'}}, function(err, data) {
          if (err) return done(err);
          data.length.should.equal(1);
          data[0].name.should.equal('John Smith');
          data[0].email.should.equal('john@b3atl3s.co.uk');
          data[0].role.should.equal('lead');
          data[0].order.should.equal(2);
          data[0].vip.should.equal(true);
          done();
        });
      });
    });
  });

  it('allows upsertWithWhere by accepting where, data, options, and cb as arguments', function(done) {
    options = {};
    User.upsertWithWhere({name: 'John Lennon'}, {name: 'John Smith'}, options, function(err) {
      if (err) return done(err);
      User.find({where: {name: 'John Smith'}}, function(err, data) {
        if (err) return done(err);
        data.length.should.equal(1);
        data[0].name.should.equal('John Smith');
        data[0].seq.should.equal(0);
        data[0].email.should.equal('john@b3atl3s.co.uk');
        data[0].role.should.equal('lead');
        data[0].order.should.equal(2);
        data[0].vip.should.equal(true);
        done();
      });
    });
  });
});

function seed(done) {
  var beatles = [
    {
      seq: 0,
      name: 'John Lennon',
      email: 'john@b3atl3s.co.uk',
      role: 'lead',
      birthday: new Date('1980-12-08'),
      order: 2,
      vip: true,
    },
    {
      seq: 1,
      name: 'Paul McCartney',
      email: 'paul@b3atl3s.co.uk',
      role: 'lead',
      birthday: new Date('1942-06-18'),
      order: 1,
      vip: true,
    },
    {seq: 2, name: 'George Harrison', order: 5, vip: false},
    {seq: 3, name: 'Ringo Starr', order: 6, vip: false},
    {seq: 4, name: 'Pete Best', order: 4},
    {seq: 5, name: 'Stuart Sutcliffe', order: 3, vip: true},
  ];

  async.series([
    User.destroyAll.bind(User),
    function(cb) {
      async.each(beatles, User.create.bind(User), cb);
    },
  ], done);
}
