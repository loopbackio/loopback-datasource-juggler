var jdb = require('../');
var DataSource = jdb.DataSource;
var path = require('path');
var fs = require('fs');
var assert = require('assert');
var async = require('async');
var should = require('./init.js');
var Memory = require('../lib/connectors/memory').Memory;

describe('Memory connector', function() {
  var file = path.join(__dirname, 'memory.json');

  function readModels(done) {
    fs.readFile(file, function(err, data) {
      var json = JSON.parse(data.toString());
      assert(json.models);
      assert(json.ids.User);
      done(err, json);
    });
  }

  before(function(done) {
    fs.unlink(file, function(err) {
      if (!err || err.code === 'ENOENT') {
        done();
      }
    });
  });

  describe('with file', function() {
    function createUserModel() {
      var ds = new DataSource({
        connector: 'memory',
        file: file
      });

      var User = ds.createModel('User', {
        id: {
          type: Number,
          id: true,
          generated: true
        },
        name: String,
        bio: String,
        approved: Boolean,
        joinedAt: Date,
        age: Number
      });
      return User;
    }

    var User;
    var ids = [];

    before(function() {
      User = createUserModel();
    });

    it('should persist create', function(done) {
      var count = 0;
      async.eachSeries(['John1', 'John2', 'John3'], function(item, cb) {
        User.create({name: item}, function(err, result) {
          ids.push(result.id);
          count++;
          readModels(function(err, json) {
            assert.equal(Object.keys(json.models.User).length, count);
            cb(err);
          });
        });
      }, done);
    });

    it('should persist delete', function(done) {
      // Now try to delete one
      User.deleteById(ids[0], function(err) {
        if (err) {
          return done(err);
        }
        readModels(function(err, json) {
          if (err) {
            return done(err);
          }
          assert.equal(Object.keys(json.models.User).length, 2);
          done();
        });
      });
    });

    it('should persist upsert', function(done) {
      User.upsert({id: ids[1], name: 'John'}, function(err, result) {
        if (err) {
          return done(err);
        }
        readModels(function(err, json) {
          if (err) {
            return done(err);
          }
          assert.equal(Object.keys(json.models.User).length, 2);
          var user = JSON.parse(json.models.User[ids[1]]);
          assert.equal(user.name, 'John');
          assert(user.id === ids[1]);
          done();
        });
      });
    });

    it('should persist update', function(done) {
      User.update({id: ids[1]}, {name: 'John1'},
        function(err, result) {
          if (err) {
            return done(err);
          }
          readModels(function(err, json) {
            if (err) {
              return done(err);
            }
            assert.equal(Object.keys(json.models.User).length, 2);
            var user = JSON.parse(json.models.User[ids[1]]);
            assert.equal(user.name, 'John1');
            assert(user.id === ids[1]);
            done();
          });
        });
    });

    // The saved memory.json from previous test should be loaded
    it('should load from the json file', function(done) {
      User.find(function(err, users) {
        // There should be 2 records
        assert.equal(users.length, 2);
        done(err);
      });

    });
  });

  describe('Query for memory connector', function() {
    var ds = new DataSource({
      connector: 'memory'
    });

    var User = ds.define('User', {
      seq: {type: Number, index: true},
      name: {type: String, index: true, sort: true},
      email: {type: String, index: true},
      birthday: {type: Date, index: true},
      role: {type: String, index: true},
      order: {type: Number, index: true, sort: true},
      vip: {type: Boolean},
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String
      }
    });

    before(seed);
    it('should allow to find using like', function(done) {
      User.find({where: {name: {like: '%St%'}}}, function(err, posts) {
        should.not.exist(err);
        posts.should.have.property('length', 2);
        done();
      });
    });

    it('should support like for no match', function(done) {
      User.find({where: {name: {like: 'M%XY'}}}, function(err, posts) {
        should.not.exist(err);
        posts.should.have.property('length', 0);
        done();
      });
    });

    it('should allow to find using nlike', function(done) {
      User.find({where: {name: {nlike: '%St%'}}}, function(err, posts) {
        should.not.exist(err);
        posts.should.have.property('length', 4);
        done();
      });
    });

    it('should support nlike for no match', function(done) {
      User.find({where: {name: {nlike: 'M%XY'}}}, function(err, posts) {
        should.not.exist(err);
        posts.should.have.property('length', 6);
        done();
      });
    });

    it('should throw if the like value is not string or regexp', function(done) {
      User.find({where: {name: {like: 123}}}, function(err, posts) {
        should.exist(err);
        done();
      });
    });

    it('should throw if the nlike value is not string or regexp', function(done) {
      User.find({where: {name: {nlike: 123}}}, function(err, posts) {
        should.exist(err);
        done();
      });
    });

    it('should throw if the inq value is not an array', function(done) {
      User.find({where: {name: {inq: '12'}}}, function(err, posts) {
        should.exist(err);
        done();
      });
    });

    it('should throw if the nin value is not an array', function(done) {
      User.find({where: {name: {nin: '12'}}}, function(err, posts) {
        should.exist(err);
        done();
      });
    });

    it('should throw if the between value is not an array', function(done) {
      User.find({where: {name: {between: '12'}}}, function(err, posts) {
        should.exist(err);
        done();
      });
    });

    it('should throw if the between value is not an array of length 2', function(done) {
      User.find({where: {name: {between: ['12']}}}, function(err, posts) {
        should.exist(err);
        done();
      });
    });

    it('should successfully extract 5 users from the db', function(done) {
      User.find({where: {seq: {between: [1,5]}}}, function(err, users) {
        should(users.length).be.equal(5);
        done();
      });
    });

    it('should successfully extract 1 user (Lennon) from the db', function(done) {
      User.find({where: {birthday: {between: [new Date(1970,0),new Date(1990,0)]}}},
                function(err, users) {
        should(users.length).be.equal(1);
        should(users[0].name).be.equal('John Lennon');
        done();
      });
    });

    it('should successfully extract 2 users from the db', function(done) {
      User.find({where: {birthday: {between: [new Date(1940,0),new Date(1990,0)]}}},
                function(err, users) {
        should(users.length).be.equal(2);
        done();
      });
    });

    it('should successfully extract 0 user from the db', function(done) {
      User.find({where: {birthday: {between: [new Date(1990,0), Date.now()]}}},
                function(err, users) {
        should(users.length).be.equal(0);
        done();
      });
    });

    it('should support order with multiple fields', function(done) {
      User.find({order: 'vip ASC, seq DESC'}, function(err, posts) {
        should.not.exist(err);
        posts[0].seq.should.be.eql(4);
        posts[1].seq.should.be.eql(3);
        done();
      });
    });

    it('should sort undefined values to the end when ordered DESC', function(done) {
      User.find({order: 'vip ASC, order DESC'}, function(err, posts) {
        should.not.exist(err);

        posts[4].seq.should.be.eql(1);
        posts[5].seq.should.be.eql(0);
        done();
      });
    });

    it('should throw if order has wrong direction', function(done) {
      User.find({order: 'seq ABC'}, function(err, posts) {
        should.exist(err);
        done();
      });
    });

    it('should support neq operator for number', function(done) {
      User.find({where: {seq: {neq: 4}}}, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(5);
        for (var i = 0; i < users.length; i++) {
          users[i].seq.should.not.be.equal(4);
        }
        done();
      });
    });

    it('should support neq operator for string', function(done) {
      User.find({where: {role: {neq: 'lead'}}}, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(4);
        for (var i = 0; i < users.length; i++) {
          if (users[i].role) {
            users[i].role.not.be.equal('lead');
          }
        }
        done();
      });
    });

    it('should support neq operator for null', function(done) {
      User.find({where: {role: {neq: null}}}, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(2);
        for (var i = 0; i < users.length; i++) {
          should.exist(users[i].role);
        }
        done();
      });
    });

    it('should support nested property in query', function(done) {
      User.find({where: {'address.city': 'San Jose'}}, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(1);
        for (var i = 0; i < users.length; i++) {
          users[i].address.city.should.be.eql('San Jose');
        }
        done();
      });
    });

    it('should support nested property with gt in query', function(done) {
        User.find({where: {'address.city': {gt: 'San'}}}, function(err, users) {
          should.not.exist(err);
          users.length.should.be.equal(2);
          for (var i = 0; i < users.length; i++) {
            users[i].address.state.should.be.eql('CA');
          }
          done();
        });
    });

    it('should support nested property for order in query', function(done) {
      User.find({where: {'address.state': 'CA'}, order: 'address.city DESC'},
        function(err, users) {
          should.not.exist(err);
          users.length.should.be.equal(2);
          users[0].address.city.should.be.eql('San Mateo');
          users[1].address.city.should.be.eql('San Jose');
          done();
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
          vip: true,
          address: {
            street: '123 A St',
            city: 'San Jose',
            state: 'CA',
            zipCode: '95131'
          }
        },
        {
          seq: 1,
          name: 'Paul McCartney',
          email: 'paul@b3atl3s.co.uk',
          role: 'lead',
          birthday: new Date('1942-06-18'),
          order: 1,
          vip: true,
          address: {
            street: '456 B St',
            city: 'San Mateo',
            state: 'CA',
            zipCode: '94065'
          }
        },
        {seq: 2, name: 'George Harrison', order: 5, vip: false},
        {seq: 3, name: 'Ringo Starr', order: 6, vip: false},
        {seq: 4, name: 'Pete Best', order: 4},
        {seq: 5, name: 'Stuart Sutcliffe', order: 3, vip: true}
      ];

      async.series([
        User.destroyAll.bind(User),
        function(cb) {
          async.each(beatles, User.create.bind(User), cb);
        }
      ], done);
    }

  });

  it('should use collection setting', function(done) {
    var ds = new DataSource({
      connector: 'memory'
    });

    var Product = ds.createModel('Product', {
      name: String
    });

    var Tool = ds.createModel('Tool', {
      name: String
    }, {memory: {collection: 'Product'}});

    var Widget = ds.createModel('Widget', {
      name: String
    }, {memory: {collection: 'Product'}});

    ds.connector.getCollection('Tool').should.equal('Product');
    ds.connector.getCollection('Widget').should.equal('Product');

    async.series([
      function(next) {
        Tool.create({ name: 'Tool A' }, next);
      },
      function(next) {
        Tool.create({ name: 'Tool B' }, next);
      },
      function(next) {
        Widget.create({ name: 'Widget A' }, next);
      }
    ], function(err) {
      Product.find(function(err, products) {
        should.not.exist(err);
        products.should.have.length(3);
        products[0].toObject().should.eql({ name: 'Tool A', id: 1 });
        products[1].toObject().should.eql({ name: 'Tool B', id: 2 });
        products[2].toObject().should.eql({ name: 'Widget A', id: 3 });
        done();
      });
    });
  });

  describe('automigrate', function() {
    var ds;
    beforeEach(function() {
      ds = new DataSource({
        connector: 'memory'
      });

      ds.createModel('m1', {
        name: String
      });
    });

    it('automigrate all models', function(done) {
      ds.automigrate(function(err) {
        done(err);
      });
    });

    it('automigrate all models - promise variant', function(done) {
      ds.automigrate()
        .then(function(result) {
          done();
        })
        .catch(function(err){
          done(err);
        });
    });

    it('automigrate one model', function(done) {
      ds.automigrate('m1', function(err) {
        done(err);
      });
    });

    it('automigrate one model - promise variant', function(done) {
      ds.automigrate('m1')
        .then(function(result) {
          done();
        })
        .catch(function(err){
          done(err);
        });
    });

    it('automigrate one or more models in an array', function(done) {
      ds.automigrate(['m1'], function(err) {
        done(err);
      });
    });

    it('automigrate one or more models in an array - promise variant', function(done) {
      ds.automigrate(['m1'])
        .then(function(result) {
          done();
        })
        .catch(function(err){
          done(err);
        });
    });

    it('automigrate reports errors for models not attached', function(done) {
      ds.automigrate(['m1', 'm2'], function(err) {
        err.should.be.an.instanceOf(Error);
        done();
      });
    });

    it('automigrate reports errors for models not attached - promise variant', function(done) {
      ds.automigrate(['m1', 'm2'])
        .then(function(){
          done(new Error('automigrate() should have failed'));
        })
        .catch(function(err){
          err.should.be.an.instanceOf(Error);
          done();
        });
    });

  });

  describe('automigrate when NO models are attached', function() {
    var ds;
    beforeEach(function() {
      ds = new DataSource({
        connector: 'memory'
      });
    });

    it('automigrate does NOT report error when NO models are attached', function(done) {
      ds.automigrate(function(err) {
        done();
      })
    });

    it('automigrate does NOT report error when NO models are attached - promise variant', function(done) {
      ds.automigrate()
        .then(done)
        .catch(function(err){
          done(err);
        });
    });
  });

});

describe('Optimized connector', function() {
  var ds = new DataSource({ connector: Memory });

  // optimized methods
  ds.connector.findOrCreate = function (model, query, data, callback) {
    this.all(model, query, {}, function (err, list) {
      if (err || (list && list[0])) return callback(err, list && list[0], false);
      this.create(model, data, {}, function (err) {
        callback(err, data, true);
      });
    }.bind(this));
  };

  require('./persistence-hooks.suite')(ds, should);
});

describe('Unoptimized connector', function() {
  var ds = new DataSource({ connector: Memory });
  // disable optimized methods
  ds.connector.updateOrCreate = false;
  ds.connector.findOrCreate = false;

  require('./persistence-hooks.suite')(ds, should);
});

describe('Memory connector with options', function() {
  var ds, savedOptions = {}, Post;

  before(function() {
    ds = new DataSource({connector: 'memory'});
    ds.connector.create = function(model, data, options, cb) {
      savedOptions.create = options;
      process.nextTick(function() {
        cb(null, 1);
      });
    };

    ds.connector.update = function(model, where, data, options, cb) {
      savedOptions.update = options;
      process.nextTick(function() {
        cb(null, {count: 1});
      });
    };

    ds.connector.all = function(model, filter, options, cb) {
      savedOptions.find = options;
      process.nextTick(function() {
        cb(null, [{title: 't1', content: 'c1'}]);
      });
    };

    Post = ds.define('Post', {
      title: String,
      content: String
    });
  });

  it('should receive options from the find method', function(done) {
    var opts = {transaction: 'tx1'};
    Post.find({where: {title: 't1'}}, opts, function(err, p) {
      savedOptions.find.should.be.eql(opts);
      done(err);
    });
  });

  it('should receive options from the find method', function(done) {
    var opts = {transaction: 'tx2'};
    Post.find({}, opts, function(err, p) {
      savedOptions.find.should.be.eql(opts);
      done(err);
    });
  });

  it('should treat first object arg as filter for find', function(done) {
    var filter = {title: 't1'};
    Post.find(filter, function(err, p) {
      savedOptions.find.should.be.eql({});
      done(err);
    });
  });

  it('should receive options from the create method', function(done) {
    var opts = {transaction: 'tx3'};
    Post.create({title: 't1', content: 'c1'}, opts, function(err, p) {
      savedOptions.create.should.be.eql(opts);
      done(err);
    });
  });

  it('should receive options from the update method', function(done) {
    var opts = {transaction: 'tx4'};
    Post.update({title: 't1'}, {content: 'c1 --> c2'},
      opts, function(err, p) {
        savedOptions.update.should.be.eql(opts);
        done(err);
      });
  });

});

describe('Memory connector with observers', function() {
  var ds = new DataSource({
    connector: 'memory'
  });

  it('should have observer mixed into the connector', function() {
    ds.connector.observe.should.be.a.function;
    ds.connector.notifyObserversOf.should.be.a.function;
  });

  it('should notify observers', function(done) {
    var events = [];
    ds.connector.execute = function(command, params, options, cb) {
      var self = this;
      var context = {command: command, params: params, options: options};
      self.notifyObserversOf('before execute', context, function(err) {
        process.nextTick(function() {
          if (err) return cb(err);
          events.push('execute');
          self.notifyObserversOf('after execute', context, function(err) {
            cb(err);
          });
        });
      });
    };

    ds.connector.observe('before execute', function(context, next) {
      events.push('before execute');
      next();
    });

    ds.connector.observe('after execute', function(context, next) {
      events.push('after execute');
      next();
    });

    ds.connector.execute('test', [1, 2], {x: 2}, function(err) {
      if (err) return done(err);
      events.should.eql(['before execute', 'execute', 'after execute']);
      done();
    });
  });
});


