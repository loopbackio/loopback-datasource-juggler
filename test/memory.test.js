// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
const jdb = require('../');
const DataSource = jdb.DataSource;
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const async = require('async');
const should = require('./init.js');
const Memory = require('../lib/connectors/memory').Memory;

describe('Memory connector', function() {
  const file = path.join(__dirname, 'memory.json');

  function readModels(done) {
    fs.readFile(file, function(err, data) {
      const json = JSON.parse(data.toString());
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
    let ds;

    function createUserModel() {
      const ds = new DataSource({
        connector: 'memory',
        file: file,
      });

      const User = ds.createModel('User', {
        id: {
          type: Number,
          id: true,
          generated: true,
        },
        name: String,
        bio: String,
        approved: Boolean,
        joinedAt: Date,
        age: Number,
      });
      return User;
    }

    let User;
    const ids = [];

    before(function() {
      User = createUserModel();
      ds = User.dataSource;
    });

    it('should allow multiple connects', function(done) {
      ds.connected = false; // Change the state to force reconnect
      async.times(10, function(n, next) {
        ds.connect(next);
      }, done);
    });

    it('should persist create', function(done) {
      let count = 0;
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

    /**
     * This test depends on the `should persist create`, which creates 3
     * records and saves into the `memory.json`. The following test makes
     * sure existing records won't be loaded out of sequence to override
     * newly created ones.
     */
    it('should not have out of sequence read/write', function(done) {
      // Create the new data source with the same file to simulate
      // existing records
      const User = createUserModel();
      const ds = User.dataSource;

      async.times(10, function(n, next) {
        if (n === 10) {
          // Make sure the connect finishes
          return ds.connect(next);
        }
        ds.connect();
        next();
      }, function(err) {
        async.eachSeries(['John4', 'John5'], function(item, cb) {
          const count = 0;
          User.create({name: item}, function(err, result) {
            ids.push(result.id);
            cb(err);
          });
        }, function(err) {
          if (err) return done(err);
          readModels(function(err, json) {
            assert.equal(Object.keys(json.models.User).length, 5);
            done();
          });
        });
      });
    });

    it('should persist delete', function(done) {
      // Force the data source to reconnect so that the updated records
      // are reloaded
      ds.disconnect(function() {
        // Now try to delete one
        User.deleteById(ids[0], function(err) {
          if (err) {
            return done(err);
          }
          readModels(function(err, json) {
            if (err) {
              return done(err);
            }
            assert.equal(Object.keys(json.models.User).length, 4);
            done();
          });
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
          assert.equal(Object.keys(json.models.User).length, 4);
          const user = JSON.parse(json.models.User[ids[1]]);
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
            assert.equal(Object.keys(json.models.User).length, 4);
            const user = JSON.parse(json.models.User[ids[1]]);
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
        assert.equal(users.length, 4);
        done(err);
      });
    });
  });

  describe('Query for memory connector', function() {
    const ds = new DataSource({
      connector: 'memory',
    });

    const User = ds.define('User', {
      seq: {type: Number, index: true},
      name: {type: String, index: true, sort: true},
      email: {type: String, index: true},
      birthday: {type: Date, index: true},
      role: {type: String, index: true},
      order: {type: Number, index: true, sort: true},
      tag: {type: String, index: true},
      vip: {type: Boolean},
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        tags: [
          {
            tag: String,
          },
        ],
      },
      friends: [
        {
          name: String,
        },
      ],
    });

    before(seed);
    it('should allow to find using like', function(done) {
      User.find({where: {name: {like: '%St%'}}}, function(err, posts) {
        should.not.exist(err);
        posts.should.have.property('length', 2);
        done();
      });
    });

    it('should properly sanitize like  invalid query', async () => {
      const users = await User.find({where: {tag: {like: '['}}});
      users.should.have.length(1);
      users[0].should.have.property('name', 'John Lennon');
    });

    it('should allow to find using like with regexp', function(done) {
      User.find({where: {name: {like: /.*St.*/}}}, function(err, posts) {
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

    it('should sanitize nlike invalid query', async () => {
      const users = await User.find({where: {name: {nlike: '['}}});
      users.should.have.length(6);
    });

    it('should allow to find using nlike with regexp', function(done) {
      User.find({where: {name: {nlike: /.*St.*/}}}, function(err, posts) {
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
      User.find({where: {seq: {between: [1, 5]}}}, function(err, users) {
        should(users.length).be.equal(5);
        done();
      });
    });

    it('should successfully extract 1 user (Lennon) from the db', function(done) {
      User.find({where: {birthday: {between: [new Date(1970, 0), new Date(1990, 0)]}}},
        function(err, users) {
          should(users.length).be.equal(1);
          should(users[0].name).be.equal('John Lennon');
          done();
        });
    });

    it('should successfully extract 1 user (Lennon) from the db by date', function(done) {
      User.find({where: {birthday: new Date('1980-12-08')}},
        function(err, users) {
          should(users.length).be.equal(1);
          should(users[0].name).be.equal('John Lennon');
          done();
        });
    });

    it('should successfully extract 2 users from the db', function(done) {
      User.find({where: {birthday: {between: [new Date(1940, 0), new Date(1990, 0)]}}},
        function(err, users) {
          should(users.length).be.equal(2);
          done();
        });
    });

    it('should successfully extract 2 users using implied and', function(done) {
      User.find({where: {role: 'lead', vip: true}}, function(err, users) {
        should(users.length).be.equal(2);
        should(users[0].name).be.equal('John Lennon');
        should(users[1].name).be.equal('Paul McCartney');
        done();
      });
    });

    it('should successfully extract 2 users using implied and & and', function(done) {
      User.find({where: {
        name: 'John Lennon',
        and: [{role: 'lead'}, {vip: true}],
      }}, function(err, users) {
        should(users.length).be.equal(1);
        should(users[0].name).be.equal('John Lennon');
        done();
      });
    });

    it('should successfully extract 2 users using date range', function(done) {
      User.find({where: {birthday: {between:
          [new Date(1940, 0).toISOString(), new Date(1990, 0).toISOString()]}}},
      function(err, users) {
        should(users.length).be.equal(2);
        done();
      });
    });

    it('should successfully extract 0 user from the db', function(done) {
      User.find({where: {birthday: {between: [new Date(1990, 0), Date.now()]}}},
        function(err, users) {
          should(users.length).be.equal(0);
          done();
        });
    });

    it('should successfully extract 2 users matching over array values', function(done) {
      User.find({
        where: {
          children: {
            regexp: /an/,
          },
        },
      }, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(2);
        users[0].name.should.be.equal('John Lennon');
        users[1].name.should.be.equal('George Harrison');
        done();
      });
    });

    it('should successfully extract 1 users matching over array values', function(done) {
      User.find({
        where: {
          children: 'Dhani',
        },
      }, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(1);
        users[0].name.should.be.equal('George Harrison');
        done();
      });
    });

    it('should successfully extract 5 users matching a neq filter over array values', function(done) {
      User.find({
        where: {
          children: {neq: 'Dhani'},
        },
      }, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(5);
        done();
      });
    });

    it('should successfully extract 3 users with inq', function(done) {
      User.find({
        where: {seq: {inq: [0, 1, 5]}},
      }, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(3);
        done();
      });
    });

    it('should successfully extract 4 users with nin', function(done) {
      User.find({
        where: {seq: {nin: [2, 3]}},
      }, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(4);
        done();
      });
    });

    it('should count using date string', function(done) {
      User.count({birthday: {lt: new Date(1990, 0).toISOString()}},
        function(err, count) {
          should(count).be.equal(2);
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
        for (let i = 0; i < users.length; i++) {
          users[i].seq.should.not.be.equal(4);
        }
        done();
      });
    });

    it('should support neq operator for string', function(done) {
      User.find({where: {role: {neq: 'lead'}}}, function(err, users) {
        should.not.exist(err);
        users.length.should.be.equal(4);
        for (let i = 0; i < users.length; i++) {
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
        for (let i = 0; i < users.length; i++) {
          should.exist(users[i].role);
        }
        done();
      });
    });

    it('should work when a regex is provided without the regexp operator',
      function(done) {
        User.find({where: {name: /John.*/i}}, function(err, users) {
          should.not.exist(err);
          users.length.should.equal(1);
          users[0].name.should.equal('John Lennon');
          done();
        });
      });

    it('should support the regexp operator with regex strings', function(done) {
      User.find({where: {name: {regexp: 'non$'}}}, function(err, users) {
        should.not.exist(err);
        users.length.should.equal(1);
        users[0].name.should.equal('John Lennon');
        done();
      });
    });

    it('should support the regexp operator with regex literals', function(done) {
      User.find({where: {name: {regexp: /^J/}}}, function(err, users) {
        should.not.exist(err);
        users.length.should.equal(1);
        users[0].name.should.equal('John Lennon');
        done();
      });
    });

    it('should support the regexp operator with regex objects', function(done) {
      User.find({where: {name: {regexp: new RegExp(/^J/)}}}, function(err,
        users) {
        should.not.exist(err);
        users.length.should.equal(1);
        users[0].name.should.equal('John Lennon');
        done();
      });
    });

    it('should deserialize values after saving in upsert', function(done) {
      User.findOne({where: {seq: 1}}, function(err, paul) {
        User.updateOrCreate({id: paul.id, name: 'Sir Paul McCartney'},
          function(err, sirpaul) {
            should.not.exist(err);
            sirpaul.birthday.should.be.instanceOf(Date);
            sirpaul.order.should.be.instanceOf(Number);
            sirpaul.vip.should.be.instanceOf(Boolean);
            done();
          });
      });
    });

    it('should handle constructor.prototype', function(done) {
      User.find({where: {'constructor.prototype': {toString: 'Not a function'}}}, function(err,
        users) {
        should.not.exist(err);
        users.length.should.equal(0);
        done();
      });
    });

    it('should handle constructor/prototype', function(done) {
      User.find({where: {constructor: {prototype: {toString: 'Not a function'}}}}, function(err,
        users) {
        should.not.exist(err);
        users.length.should.equal(0);
        done();
      });
    });

    it('should handle toString', function(done) {
      User.find({where: {toString: 'Not a function'}}, function(err,
        users) {
        should.not.exist(err);
        users.length.should.equal(0);
        done();
      });
    });

    function seed(done) {
      const beatles = [
        {
          seq: 0,
          name: 'John Lennon',
          email: 'john@b3atl3s.co.uk',
          role: 'lead',
          birthday: new Date('1980-12-08'),
          vip: true,
          tag: '[singer]',
          address: {
            street: '123 A St',
            city: 'San Jose',
            state: 'CA',
            zipCode: '95131',
            tags: [
              {tag: 'business'},
              {tag: 'rent'},
            ],
          },
          friends: [
            {name: 'Paul McCartney'},
            {name: 'George Harrison'},
            {name: 'Ringo Starr'},
          ],
          children: ['Sean', 'Julian'],
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
            zipCode: '94065',
          },
          friends: [
            {name: 'John Lennon'},
            {name: 'George Harrison'},
            {name: 'Ringo Starr'},
          ],
          children: ['Stella', 'Mary', 'Heather', 'Beatrice', 'James'],
        },
        {seq: 2, name: 'George Harrison', order: 5, vip: false, children: ['Dhani']},
        {seq: 3, name: 'Ringo Starr', order: 6, vip: false},
        {seq: 4, name: 'Pete Best', order: 4, children: []},
        {seq: 5, name: 'Stuart Sutcliffe', order: 3, vip: true},
      ];

      async.series([
        User.destroyAll.bind(User),
        function(cb) {
          async.each(beatles, User.create.bind(User), cb);
        },
      ], done);
    }
  });

  it('should use collection setting', function(done) {
    const ds = new DataSource({
      connector: 'memory',
    });

    const Product = ds.createModel('Product', {
      name: String,
    });

    const Tool = ds.createModel('Tool', {
      name: String,
    }, {memory: {collection: 'Product'}});

    const Widget = ds.createModel('Widget', {
      name: String,
    }, {memory: {collection: 'Product'}});

    ds.connector.getCollection('Tool').should.equal('Product');
    ds.connector.getCollection('Widget').should.equal('Product');

    async.series([
      function(next) {
        Tool.create({name: 'Tool A'}, next);
      },
      function(next) {
        Tool.create({name: 'Tool B'}, next);
      },
      function(next) {
        Widget.create({name: 'Widget A'}, next);
      },
    ], function(err) {
      Product.find(function(err, products) {
        should.not.exist(err);
        products.should.have.length(3);
        products[0].toObject().should.eql({name: 'Tool A', id: 1});
        products[1].toObject().should.eql({name: 'Tool B', id: 2});
        products[2].toObject().should.eql({name: 'Widget A', id: 3});
        done();
      });
    });
  });

  it('should refuse to create object with duplicate id', function(done) {
    const ds = new DataSource({connector: 'memory'});
    const Product = ds.define('ProductTest', {name: String}, {forceId: false});
    ds.automigrate('ProductTest', function(err) {
      if (err) return done(err);

      Product.create({name: 'a-name'}, function(err, p) {
        if (err) return done(err);
        Product.create({id: p.id, name: 'duplicate'}, function(err) {
          if (!err) {
            return done(new Error('Create should have rejected duplicate id.'));
          }
          err.message.should.match(/duplicate/i);
          err.statusCode.should.equal(409);
          done();
        });
      });
    });
  });

  describe('automigrate', function() {
    let ds;
    beforeEach(function() {
      ds = new DataSource({
        connector: 'memory',
      });

      ds.createModel('m1', {
        name: String,
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
        .catch(function(err) {
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
        .catch(function(err) {
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
        .catch(function(err) {
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
        .then(function() {
          done(new Error('automigrate() should have failed'));
        })
        .catch(function(err) {
          err.should.be.an.instanceOf(Error);
          done();
        });
    });
  });

  describe('findOrCreate', function() {
    let ds, Cars;
    before(function() {
      ds = new DataSource({connector: 'memory'});
      Cars = ds.define('Cars', {
        color: String,
      });
    });

    it('should create a specific object once and in the subsequent calls it should find it', function(done) {
      let creationNum = 0;
      async.times(100, function(n, next) {
        const initialData = {color: 'white'};
        const query = {'where': initialData};
        Cars.findOrCreate(query, initialData, function(err, car, created) {
          if (created) creationNum++;
          next(err, car);
        });
      }, function(err, cars) {
        if (err) done(err);
        Cars.find(function(err, data) {
          if (err) done(err);
          data.length.should.equal(1);
          data[0].color.should.equal('white');
          creationNum.should.equal(1);
          done();
        });
      });
    });
  });

  describe('automigrate when NO models are attached', function() {
    let ds;
    beforeEach(function() {
      ds = new DataSource({
        connector: 'memory',
      });
    });

    it('automigrate does NOT report error when NO models are attached', function(done) {
      ds.automigrate(function(err) {
        done();
      });
    });

    it('automigrate does NOT report error when NO models are attached - promise variant', function(done) {
      ds.automigrate()
        .then(done)
        .catch(function(err) {
          done(err);
        });
    });
  });

  describe('With mocked autoupdate', function() {
    let ds, model;
    beforeEach(function() {
      ds = new DataSource({
        connector: 'memory',
      });

      ds.connector.autoupdate = function(models, cb) {
        process.nextTick(cb);
      };

      model = ds.createModel('m1', {
        name: String,
      });

      ds.automigrate();

      ds.createModel('m1', {
        name: String,
        address: String,
      });
    });

    it('autoupdates all models', function(done) {
      ds.autoupdate(function(err, result) {
        done(err);
      });
    });

    it('autoupdates all models - promise variant', function(done) {
      ds.autoupdate()
        .then(function(result) {
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    it('autoupdates one model', function(done) {
      ds.autoupdate('m1', function(err) {
        done(err);
      });
    });

    it('autoupdates one model - promise variant', function(done) {
      ds.autoupdate('m1')
        .then(function(result) {
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    it('autoupdates one or more models in an array', function(done) {
      ds.autoupdate(['m1'], function(err) {
        done(err);
      });
    });

    it('autoupdates one or more models in an array - promise variant', function(done) {
      ds.autoupdate(['m1'])
        .then(function(result) {
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    it('autoupdate reports errors for models not attached', function(done) {
      ds.autoupdate(['m1', 'm2'], function(err) {
        err.should.be.an.instanceOf(Error);
        done();
      });
    });

    it('autoupdate reports errors for models not attached - promise variant', function(done) {
      ds.autoupdate(['m1', 'm2'])
        .then(function() {
          done(new Error('automigrate() should have failed'));
        })
        .catch(function(err) {
          err.should.be.an.instanceOf(Error);
          done();
        });
    });
  });
});

describe('Optimized connector', function() {
  const ds = new DataSource({connector: Memory});

  require('./persistence-hooks.suite')(ds, should, {
    replaceOrCreateReportsNewInstance: true,
  });
});

describe('Unoptimized connector', function() {
  const ds = new DataSource({connector: Memory});

  // disable optimized methods
  ds.connector.updateOrCreate = false;
  ds.connector.findOrCreate = false;
  ds.connector.upsertWithWhere = false;

  // disable native location queries
  ds.connector.buildNearFilter = false;

  require('./persistence-hooks.suite')(ds, should, {
    replaceOrCreateReportsNewInstance: true,
  });
});

describe('Memory connector with options', function() {
  const savedOptions = {};
  let ds, Post;

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
      content: String,
    });
  });

  it('should receive options from the find method', function(done) {
    const opts = {transaction: 'tx1'};
    Post.find({where: {title: 't1'}}, opts, function(err, p) {
      savedOptions.find.should.be.eql(opts);
      done(err);
    });
  });

  it('should treat first object arg as filter for find', function(done) {
    const filter = {title: 't1'};
    Post.find(filter, function(err, p) {
      savedOptions.find.should.be.eql({});
      done(err);
    });
  });

  it('should receive options from the create method', function(done) {
    const opts = {transaction: 'tx3'};
    Post.create({title: 't1', content: 'c1'}, opts, function(err, p) {
      savedOptions.create.should.be.eql(opts);
      done(err);
    });
  });

  it('should receive options from the update method', function(done) {
    const opts = {transaction: 'tx4'};
    Post.update({title: 't1'}, {content: 'c1 --> c2'},
      opts, function(err, p) {
        savedOptions.update.should.be.eql(opts);
        done(err);
      });
  });
});

describe('Memory connector with observers', function() {
  const ds = new DataSource({
    connector: 'memory',
  });

  it('should have observer mixed into the connector', function() {
    ds.connector.observe.should.be.a.function;
    ds.connector.notifyObserversOf.should.be.a.function;
  });

  it('should notify observers', function(done) {
    const events = [];
    ds.connector.execute = function(command, params, options, cb) {
      const self = this;
      const context = {command: command, params: params, options: options};
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
