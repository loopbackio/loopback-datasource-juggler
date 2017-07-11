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

var db, User;

describe('basic-querying', function() {
  before(function(done) {
    var userModelDef = {
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
      addressLoc: {
        lat: Number,
        lng: Number,
      },
    };

    db = getSchema();
    // connectors that do not support geo-point types
    connectorCapabilities.geoPoint = (db.adapter.name != 'dashdb') && (db.adapter.name != 'db2') &&
    (db.adapter.name != 'informix') && (db.adapter.name != 'cassandra');
    if (connectorCapabilities.geoPoint) userModelDef.addressLoc = {type: 'GeoPoint'};
    User = db.define('User', userModelDef);
    db.automigrate(done);
  });

  describe('ping', function() {
    it('should be able to test connections', function(done) {
      db.ping(function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('findById', function() {
    before(function(done) {
      db = getSchema();
      User.destroyAll(done);
    });

    it('should query by id: not found', function(done) {
      var unknownId = uid.fromConnector(db) || 1;
      User.findById(unknownId, function(err, u) {
        should.not.exist(u);
        should.not.exist(err);
        done();
      });
    });

    it('should query by id: found', function(done) {
      User.create(function(err, u) {
        should.not.exist(err);
        should.exist(u.id);
        User.findById(u.id, function(err, u) {
          should.exist(u);
          should.not.exist(err);
          u.should.be.an.instanceOf(User);
          done();
        });
      });
    });
  });

  describe('findByIds', function() {
    var createdUsers;
    before(function(done) {
      db = getSchema();
      var people = [
        {name: 'a', vip: true},
        {name: 'b', vip: null},
        {name: 'c'},
        {name: 'd', vip: true},
        {name: 'e'},
        {name: 'f'},
      ];
      db.automigrate(['User'], function(err) {
        User.create(people, function(err, users) {
          should.not.exist(err);
          // Users might be created in parallel and the generated ids can be
          // out of sequence
          createdUsers = users;
          done();
        });
      });
    });

    it('should query by ids', function(done) {
      User.findByIds(
        [createdUsers[2].id, createdUsers[1].id, createdUsers[0].id],
        function(err, users) {
          should.exist(users);
          should.not.exist(err);
          var names = users.map(function(u) {
            return u.name;
          });
          names.should.eql(
            [createdUsers[2].name, createdUsers[1].name, createdUsers[0].name]);
          done();
        });
    });

    it('should query by ids and condition', function(done) {
      User.findByIds([
        createdUsers[0].id,
        createdUsers[1].id,
        createdUsers[2].id,
        createdUsers[3].id],
        {where: {vip: true}}, function(err, users) {
          should.exist(users);
          should.not.exist(err);
          var names = users.map(function(u) {
            return u.name;
          });
          names.should.eql(createdUsers.slice(0, 4).
            filter(function(u) {
              return u.vip;
            }).map(function(u) {
              return u.name;
            }));
          done();
        });
    });

    bdd.itIf(connectorCapabilities.nullDataValueExists !== false,
    'should query by ids to check null property', function(done) {
      User.findByIds([
        createdUsers[0].id,
        createdUsers[1].id],
        {where: {vip: null}}, function(err, users) {
          should.not.exist(err);
          should.exist(users);
          users.length.should.eql(1);
          users[0].name.should.eql(createdUsers[1].name);
          done();
        });
    });
  });

  describe('find', function() {
    before(seed);

    before(function setupDelayingLoadedHook() {
      User.observe('loaded', nextAfterDelay);
    });

    after(function removeDelayingLoadHook() {
      User.removeObserver('loaded', nextAfterDelay);
    });

    it('should query collection', function(done) {
      User.find(function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(6);
        done();
      });
    });

    it('should query limited collection', function(done) {
      User.find({limit: 3}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(3);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.supportPagination !== false, 'should query collection with skip & ' +
    'limit', function(done) {
      User.find({skip: 1, limit: 4, order: 'seq'}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users[0].seq.should.be.eql(1);
        users.should.have.lengthOf(4);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.supportPagination !== false, 'should query collection with offset & ' +
    'limit', function(done) {
      User.find({offset: 2, limit: 3, order: 'seq'}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users[0].seq.should.be.eql(2);
        users.should.have.lengthOf(3);
        done();
      });
    });

    it('should query filtered collection', function(done) {
      User.find({where: {role: 'lead'}}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(2);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.adhocSort !== false, 'should query collection sorted by numeric ' +
    'field', function(done) {
      User.find({order: 'order'}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.forEach(function(u, i) {
          u.order.should.eql(i + 1);
        });
        done();
      });
    });

    bdd.itIf(connectorCapabilities.adhocSort !== false, 'should query collection desc sorted by ' +
    'numeric field', function(done) {
      User.find({order: 'order DESC'}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.forEach(function(u, i) {
          u.order.should.eql(users.length - i);
        });
        done();
      });
    });

    bdd.itIf(connectorCapabilities.adhocSort !== false, 'should query collection sorted by string ' +
    'field', function(done) {
      User.find({order: 'name'}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.shift().name.should.equal('George Harrison');
        users.shift().name.should.equal('John Lennon');
        users.pop().name.should.equal('Stuart Sutcliffe');
        done();
      });
    });

    bdd.itIf(connectorCapabilities.adhocSort !== false, 'should query collection desc sorted by ' +
    'string field', function(done) {
      User.find({order: 'name DESC'}, function(err, users) {
        should.exists(users);
        should.not.exists(err);
        users.pop().name.should.equal('George Harrison');
        users.pop().name.should.equal('John Lennon');
        users.shift().name.should.equal('Stuart Sutcliffe');
        done();
      });
    });

    bdd.itIf(connectorCapabilities.adhocSort !== false, 'should query sorted desc by order integer field' +
    ' even though there is an async model loaded hook', function(done) {
      User.find({order: 'order DESC'}, function(err, users) {
        if (err) return done(err);
        should.exists(users);
        var order = users.map(function(u) { return u.order; });
        order.should.eql([6, 5, 4, 3, 2, 1]);
        done();
      });
    });

    it('should support "and" operator that is satisfied', function(done) {
      User.find({where: {and: [
        {name: 'John Lennon'},
        {role: 'lead'},
      ]}}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 1);
        done();
      });
    });

    it('should support "and" operator that is not satisfied', function(done) {
      User.find({where: {and: [
        {name: 'John Lennon'},
        {role: 'member'},
      ]}}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.supportOrOperator !== false, 'should support "or" that is ' +
    'satisfied', function(done) {
      User.find({where: {or: [
        {name: 'John Lennon'},
        {role: 'lead'},
      ]}}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 2);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.supportOrOperator !== false, 'should support "or" operator that is ' +
    'not satisfied', function(done) {
      User.find({where: {or: [
        {name: 'XYZ'},
        {role: 'Hello1'},
      ]}}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.nullDataValueExists !== false,
    'should support where date "neq" null', function(done) {
      User.find({where: {birthday: {'neq': null},
      }}, function(err, users) {
        should.not.exist(err);
        should.exist(users);
        users.should.have.property('length', 2);
        should(users[0].name).be.oneOf('John Lennon', 'Paul McCartney');
        should(users[1].name).be.oneOf('John Lennon', 'Paul McCartney');
        done();
      });
    });

    bdd.itIf(connectorCapabilities.nullDataValueExists !== false,
    'should support where date is null', function(done) {
      User.find({where: {birthday: null,
      }}, function(err, users) {
        should.not.exist(err);
        should.exist(users);
        users.should.have.property('length', 4);
        done();
      });
    });

    it('should support date "gte" that is satisfied', function(done) {
      User.find({where: {birthday: {'gte': new Date('1980-12-08')},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 1);
        users[0].name.should.equal('John Lennon');
        done();
      });
    });

    it('should support date "gt" that is not satisfied', function(done) {
      User.find({where: {birthday: {'gt': new Date('1980-12-08')},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    it('should support date "gt" that is satisfied', function(done) {
      User.find({where: {birthday: {'gt': new Date('1980-12-07')},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 1);
        users[0].name.should.equal('John Lennon');
        done();
      });
    });

    bdd.itIf(connectorCapabilities.cloudantCompatible !== false,
      'should support date "lt" that is satisfied', function(done) {
        User.find({where: {birthday: {'lt': new Date('1980-12-07')},
        }}, function(err, users) {
          should.not.exist(err);
          users.should.have.property('length', 1);
          users[0].name.should.equal('Paul McCartney');
          done();
        });
      });

    it('should support number "gte" that is satisfied', function(done) {
      User.find({where: {order: {'gte': 3}}}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 4);
        users.map(u => u.name).should.containDeep([
          'George Harrison', 'Ringo Starr', 'Pete Best', 'Stuart Sutcliffe',
        ]);
        done();
      });
    });

    it('should support number "gt" that is not satisfied', function(done) {
      User.find({where: {order: {'gt': 6},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    it('should support number "gt" that is satisfied', function(done) {
      User.find({where: {order: {'gt': 5},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 1);
        users[0].name.should.equal('Ringo Starr');
        done();
      });
    });

    it('should support number "lt" that is satisfied', function(done) {
      User.find({where: {order: {'lt': 2},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 1);
        users[0].name.should.equal('Paul McCartney');
        done();
      });
    });

    bdd.itIf(connectorCapabilities.ignoreUndefinedConditionValue !== false, 'should support number "gt" ' +
    'that is satisfied by null value', function(done) {
      User.find({order: 'seq', where: {order: {'gt': null}}}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.ignoreUndefinedConditionValue !== false, 'should support number "lt" ' +
    'that is not satisfied by null value', function(done) {
      User.find({where: {order: {'lt': null}}}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.ignoreUndefinedConditionValue !== false, 'should support string "gte" ' +
    'that is satisfied by null value', function(done) {
      User.find({order: 'seq', where: {name: {'gte': null}}}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.cloudantCompatible !== false,
      'should support string "gte" that is satisfied', function(done) {
        User.find({where: {name: {'gte': 'Paul McCartney'}}}, function(err, users) {
          should.not.exist(err);
          users.should.have.property('length', 4);
          for (var ix = 0; ix < users.length; ix++) {
            users[ix].name.should.be.greaterThanOrEqual('Paul McCartney');
          }
          done();
        });
      });

    it('should support string "gt" that is not satisfied', function(done) {
      User.find({where: {name: {'gt': 'xyz'},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    bdd.itIf(connectorCapabilities.cloudantCompatible !== false,
      'should support string "gt" that is satisfied', function(done) {
        User.find({where: {name: {'gt': 'Paul McCartney'},
        }}, function(err, users) {
          should.not.exist(err);
          users.should.have.property('length', 3);
          for (var ix = 0; ix < users.length; ix++) {
            users[ix].name.should.be.greaterThan('Paul McCartney');
          }
          done();
        });
      });

    bdd.itIf(connectorCapabilities.cloudantCompatible !== false,
      'should support string "lt" that is satisfied', function(done) {
        User.find({where: {name: {'lt': 'Paul McCartney'},
        }}, function(err, users) {
          should.not.exist(err);
          users.should.have.property('length', 2);
          for (var ix = 0; ix < users.length; ix++) {
            users[ix].name.should.be.lessThan('Paul McCartney');
          }
          done();
        });
      });

    it('should support boolean "gte" that is satisfied', function(done) {
      User.find({where: {vip: {'gte': true},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 3);
        for (var ix = 0; ix < users.length; ix++) {
          users[ix].name.should.be.oneOf(['John Lennon', 'Stuart Sutcliffe', 'Paul McCartney']);
          users[ix].vip.should.be.true();
        };
        done();
      });
    });

    it('should support boolean "gt" that is not satisfied', function(done) {
      User.find({where: {vip: {'gt': true},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 0);
        done();
      });
    });

    it('should support boolean "gt" that is satisfied', function(done) {
      User.find({where: {vip: {'gt': false},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 3);
        for (var ix = 0; ix < users.length; ix++) {
          users[ix].name.should.be.oneOf(['John Lennon', 'Stuart Sutcliffe', 'Paul McCartney']);
          users[ix].vip.should.be.true(users[ix].name + ' should be VIP');
        }
        done();
      });
    });

    it('should support boolean "lt" that is satisfied', function(done) {
      User.find({where: {vip: {'lt': true},
      }}, function(err, users) {
        should.not.exist(err);
        users.should.have.property('length', 2);
        for (var ix = 0; ix < users.length; ix++) {
          users[ix].name.should.be.oneOf(['Ringo Starr', 'George Harrison']);
          users[ix].vip.should.be.false(users[ix].name + ' should not be VIP');
        }
        done();
      });
    });

    bdd.itIf(connectorCapabilities.supportInq, 'supports non-empty inq', function() {
      // note there is no record with seq=100
      return User.find({where: {seq: {inq: [0, 1, 100]}}})
        .then(result => {
          const seqsFound = result.map(r => r.seq);
          should(seqsFound).eql([0, 1]);
        });
    });

    bdd.itIf(connectorCapabilities.supportInq, 'supports empty inq', function() {
      return User.find({where: {seq: {inq: []}}})
        .then(result => {
          const seqsFound = result.map(r => r.seq);
          should(seqsFound).eql([]);
        });
    });

    var itWhenIlikeSupported = connectorCapabilities.ilike;
    bdd.describeIf(itWhenIlikeSupported, 'ilike', function() {
      it('should support "like" that is satisfied',
        function(done) {
          User.find({where: {name: {like: 'John'}}},
            function(err, users) {
              if (err) return done(err);
              users.length.should.equal(1);
              users[0].name.should.equal('John Lennon');
              done();
            });
        });

      it('should support "like" that is not satisfied',
        function(done) {
          User.find({where: {name: {like: 'Bob'}}},
            function(err, users) {
              if (err) return done(err);
              users.length.should.equal(0);
              done();
            });
        });
      it('should support "ilike" that is satisfied', function(done) {
        User.find({where: {name: {ilike: 'john'}}},
          function(err, users) {
            if (err) return done(err);
            users.length.should.equal(1);
            users[0].name.should.equal('John Lennon');
            done();
          });
      });
      it('should support "ilike" that is not satisfied', function(done) {
        User.find({where: {name: {ilike: 'bob'}}}, function(err, users) {
          if (err) return done(err);
          users.length.should.equal(0);
          done();
        });
      });
    });

    var itWhenNilikeSupported = connectorCapabilities.nilike !== false;
    bdd.describeIf(itWhenNilikeSupported, 'nilike', function() {
      it('should support "nlike" that is satisfied', function(done) {
        User.find({where: {name: {nlike: 'John'}}},
          function(err, users) {
            if (err) return done(err);
            users.length.should.equal(5);
            users[0].name.should.equal('Paul McCartney');
            done();
          });
      });

      it('should support "nilike" that is satisfied', function(done) {
        User.find({where: {name: {nilike: 'john'}}},
          function(err, users) {
            if (err) return done(err);
            users.length.should.equal(5);
            users[0].name.should.equal('Paul McCartney');
            done();
          });
      });
    });

    describe('geo queries', function() {
      describe('near filter', function() {
        it('supports a basic "near" query', function(done) {
          User.find({
            where: {
              addressLoc: {
                near: {lat: 29.9, lng: -90.07},
              },
            },
          }, function(err, users) {
            if (err) done(err);
            users.should.have.property('length', 3);
            users[0].name.should.equal('John Lennon');
            users[0].addressLoc.should.not.be.null();
            done();
          });
        });

        it('supports "near" inside a coumpound query with "and"', function(done) {
          User.find({
            where: {
              and: [
                {
                  addressLoc: {
                    near: {lat: 29.9, lng: -90.07},
                  },
                },
                {
                  vip: true,
                },
              ],
            },
          }, function(err, users) {
            if (err) done(err);
            users.should.have.property('length', 2);
            users[0].name.should.equal('John Lennon');
            users[0].addressLoc.should.not.be.null();
            users[0].vip.should.be.true();
            done();
          });
        });

        it('supports "near" inside a complex coumpound query with multiple "and"', function(done) {
          User.find({
            where: {
              and: [
                {
                  and: [
                    {
                      addressLoc: {
                        near: {lat: 29.9, lng: -90.07},
                      },
                    },
                    {
                      order: 2,
                    },
                  ],
                },
                {
                  vip: true,
                },
              ],
            },
          }, function(err, users) {
            if (err) done(err);
            users.should.have.property('length', 1);
            users[0].name.should.equal('John Lennon');
            users[0].addressLoc.should.not.be.null();
            users[0].vip.should.be.true();
            users[0].order.should.equal(2);
            done();
          });
        });

        it('supports multiple "near" queries with "or"', function(done) {
          User.find({
            where: {
              or: [
                {
                  addressLoc: {
                    near: {lat: 29.9, lng: -90.04},
                    maxDistance: 300,
                  },
                },
                {
                  addressLoc: {
                    near: {lat: 22.97, lng: -88.03},
                    maxDistance: 50,
                  },
                },
              ],
            },
          }, function(err, users) {
            if (err) done(err);
            users.should.have.property('length', 2);
            users[0].addressLoc.should.not.be.null();
            users[0].name.should.equal('Paul McCartney');
            users[1].addressLoc.should.not.equal(null);
            users[1].name.should.equal('John Lennon');
            done();
          });
        });

        it('supports multiple "near" queries with "or" ' +
          'inside a coumpound query with "and"', function(done) {
          User.find({
            where: {
              and: [
                {
                  or: [
                    {
                      addressLoc: {
                        near: {lat: 29.9, lng: -90.04},
                        maxDistance: 300,
                      },
                    },
                    {
                      addressLoc: {
                        near: {lat: 22.7, lng: -89.03},
                        maxDistance: 50,
                      },
                    },
                  ],
                },
                {
                  vip: true,
                },
              ],
            },
          }, function(err, users) {
            if (err) done(err);
            users.should.have.property('length', 1);
            users[0].addressLoc.should.not.be.null();
            users[0].name.should.equal('John Lennon');
            users[0].vip.should.be.true();
            done();
          });
        });
      });
    });

    it('should only include fields as specified', function(done) {
      var remaining = 0;

      function sample(fields) {
        return {
          expect: function(arr) {
            remaining++;
            User.find({fields: fields}, function(err, users) {
              remaining--;
              if (err) return done(err);

              should.exists(users);

              if (remaining === 0) {
                done();
              }

              users.forEach(function(user) {
                var obj = user.toObject();

                Object.keys(obj)
                  .forEach(function(key) {
                    // if the obj has an unexpected value
                    if (obj[key] !== undefined && arr.indexOf(key) === -1) {
                      console.log('Given fields:', fields);
                      console.log('Got:', key, obj[key]);
                      console.log('Expected:', arr);
                      throw new Error('should not include data for key: ' + key);
                    }
                  });
              });
            });
          },
        };
      }

      sample({name: true}).expect(['name']);
      sample({name: false}).expect([
        'id', 'seq', 'email', 'role', 'order', 'birthday', 'vip', 'address', 'friends', 'addressLoc',
      ]);
      sample({name: false, id: true}).expect(['id']);
      sample({id: true}).expect(['id']);
      sample('id').expect(['id']);
      sample(['id']).expect(['id']);
      sample(['email']).expect(['email']);
    });

    it('should ignore non existing properties when excluding', function(done) {
      return User.find({fields: {notExist: false}}, (err, users) => {
        if (err) return done(err);
        users.forEach(user => {
          switch (user.seq) { // all fields depending on each document
            case 0:
            case 1:
              Object.keys(user.__data).should.containDeep(['id', 'seq', 'name', 'order', 'role',
                'birthday', 'vip', 'address', 'friends']);
              break;
            case 4: // seq 4
              Object.keys(user.__data).should.containDeep(['id', 'seq', 'name', 'order']);
              break;
            default: // Other records, seq 2, 3, 5
              Object.keys(user.__data).should.containDeep(['id', 'seq', 'name', 'order', 'vip']);
          }
        });
        done();
      });
    });

    var describeWhenNestedSupported = connectorCapabilities.nestedProperty;
    bdd.describeIf(describeWhenNestedSupported, 'query with nested property', function() {
      it('should support nested property in query', function(done) {
        User.find({where: {'address.city': 'San Jose'}}, function(err, users) {
          if (err) return done(err);
          users.length.should.be.equal(1);
          for (var i = 0; i < users.length; i++) {
            users[i].address.city.should.be.eql('San Jose');
          }
          done();
        });
      });

      it('should support nested property with regex over arrays in query', function(done) {
        User.find({where: {'friends.name': {regexp: /^Ringo/}}}, function(err, users) {
          if (err) return done(err);
          users.length.should.be.equal(2);
          var expectedUsers = ['John Lennon', 'Paul McCartney'];
          expectedUsers.indexOf(users[0].name).should.not.equal(-1);
          expectedUsers.indexOf(users[1].name).should.not.equal(-1);
          done();
        });
      });

      it('should support nested property with gt in query', function(done) {
        User.find({where: {'address.city': {gt: 'San'}}}, function(err, users) {
          if (err) return done(err);
          users.length.should.be.equal(2);
          for (var i = 0; i < users.length; i++) {
            users[i].address.state.should.be.eql('CA');
          }
          done();
        });
      });

      bdd.itIf(connectorCapabilities.adhocSort,
        'should support nested property for order in query',
        function(done) {
          User.find({where: {'address.state': 'CA'}, order: 'address.city DESC'},
          function(err, users) {
            if (err) return done(err);
            users.length.should.be.equal(2);
            users[0].address.city.should.be.eql('San Mateo');
            users[1].address.city.should.be.eql('San Jose');
            done();
          });
        });

      it('should support multi-level nested array property in query', function(done) {
        User.find({where: {'address.tags.tag': 'business'}}, function(err, users) {
          if (err) return done(err);
          users.length.should.be.equal(1);
          users[0].address.tags[0].tag.should.be.equal('business');
          users[0].address.tags[1].tag.should.be.equal('rent');
          done();
        });
      });

      it('should fail when querying with an invalid value for a type',
      function(done) {
        User.find({where: {birthday: 'notadate'}}, function(err, users) {
          should.exist(err);
          err.message.should.equal('Invalid date: notadate');
          done();
        });
      });
    });
  });

  describe('count', function() {
    before(seed);

    it('should query total count', function(done) {
      User.count(function(err, n) {
        should.not.exist(err);
        should.exist(n);
        n.should.equal(6);
        done();
      });
    });

    it('should query filtered count', function(done) {
      User.count({role: 'lead'}, function(err, n) {
        should.not.exist(err);
        should.exist(n);
        n.should.equal(2);
        done();
      });
    });
  });

  describe('findOne', function() {
    before(seed);

    bdd.itIf(connectorCapabilities.cloudantCompatible !== false,
      'should find first record (default sort by id)', function(done) {
        User.all({order: 'id'}, function(err, users) {
          User.findOne(function(e, u) {
            should.not.exist(e);
            should.exist(u);
            u.id.toString().should.equal(users[0].id.toString());
            done();
          });
        });
      });

    bdd.itIf(connectorCapabilities.adhocSort, 'should find first record', function(done) {
      User.findOne({order: 'order'}, function(e, u) {
        should.not.exist(e);
        should.exist(u);
        u.order.should.equal(1);
        u.name.should.equal('Paul McCartney');
        done();
      });
    });

    bdd.itIf(connectorCapabilities.adhocSort, 'should find last record', function(done) {
      User.findOne({order: 'order DESC'}, function(e, u) {
        should.not.exist(e);
        should.exist(u);
        u.order.should.equal(6);
        u.name.should.equal('Ringo Starr');
        done();
      });
    });

    bdd.itIf(connectorCapabilities.adhocSort, 'should find last record in filtered set', function(done) {
      User.findOne({
        where: {role: 'lead'},
        order: 'order DESC',
      }, function(e, u) {
        should.not.exist(e);
        should.exist(u);
        u.order.should.equal(2);
        u.name.should.equal('John Lennon');
        done();
      });
    });

    it('should work even when find by id', function(done) {
      User.findOne(function(e, u) {
        User.findOne({where: {id: u.id}}, function(err, user) {
          should.not.exist(err);
          should.exist(user);
          done();
        });
      });
    });
  });

  describe('exists', function() {
    before(seed);

    it('should check whether record exist', function(done) {
      User.findOne(function(e, u) {
        User.exists(u.id, function(err, exists) {
          should.not.exist(err);
          should.exist(exists);
          exists.should.be.ok;
          done();
        });
      });
    });

    it('should check whether record not exist', function(done) {
      var unknownId = uid.fromConnector(db) || 42;
      User.destroyAll(function() {
        User.exists(unknownId, function(err, exists) {
          should.not.exist(err);
          exists.should.not.be.ok;
          done();
        });
      });
    });
  });

  context('regexp operator', function() {
    var invalidDataTypes = [0, true, {}, [], Function, null];

    before(seed);

    it('should return an error for invalid data types', function(done) {
      // `undefined` is not tested because the `removeUndefined` function
      // in `lib/dao.js` removes it before coercion
      invalidDataTypes.forEach(function(invalidDataType) {
        User.find({where: {name: {regexp: invalidDataType}}}, function(err,
            users) {
          should.exist(err);
        });
      });
      done();
    });
  });
});

// FIXME: This should either be re-enabled or removed.
describe.skip('queries', function() {
  var Todo;

  before(function prepDb(done) {
    db = getSchema();
    Todo = db.define('Todo', {
      id: false,
      content: {type: 'string'},
    }, {
      idInjection: false,
    });
    db.automigrate(['Todo'], done);
  });
  beforeEach(function resetFixtures(done) {
    db = getSchema();
    Todo.destroyAll(function() {
      Todo.create([
        {content: 'Buy eggs'},
        {content: 'Buy milk'},
        {content: 'Buy sausages'},
      ], done);
    });
  });

  context('that do not require an id', function() {
    it('should work for create', function(done) {
      Todo.create({content: 'Buy ham'}, function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should work for updateOrCreate/upsert', function(done) {
      var aliases = ['updateOrCreate', 'upsert'];
      async.each(aliases, function(alias, cb) {
        Todo[alias]({content: 'Buy ham'}, function(err) {
          should.not.exist(err);
          cb();
        });
      }, done);
    });

    it('should work for findOrCreate', function(done) {
      Todo.findOrCreate({content: 'Buy ham'}, function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should work for exists', function(done) {
      Todo.exists({content: 'Buy ham'}, function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should work for find', function(done) {
      Todo.find(function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should work for findOne', function(done) {
      Todo.findOne(function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should work for deleteAll/destroyAll/remove', function(done) {
      // FIXME: We should add a DAO.delete static method alias for consistency
      // (DAO.prototype.delete instance method already exists)
      var aliases = ['deleteAll', 'destroyAll', 'remove'];
      async.each(aliases, function(alias, cb) {
        Todo[alias](function(err) {
          should.not.exist(err);
          cb();
        });
      }, done);
    });

    it('should work for update/updateAll', function(done) {
      Todo.update({content: 'Buy ham'}, function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should work for count', function(done) {
      Todo.count({content: 'Buy eggs'}, function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  context('that require an id', function() {
    var expectedErrMsg = 'Primary key is missing for the Todo model';

    it('should return an error for findById', function(done) {
      Todo.findById(1, function(err) {
        should.exist(err);
        err.message.should.equal(expectedErrMsg);
        done();
      });
    });

    it('should return an error for findByIds', function(done) {
      Todo.findByIds([1, 2], function(err) {
        should.exist(err);
        err.message.should.equal(expectedErrMsg);
        done();
      });
    });

    it('should return an error for deleteById/destroyById/removeById',
    function(done) {
      var aliases = ['deleteById', 'destroyById', 'removeById'];
      async.each(aliases, function(alias, cb) {
        Todo[alias](1, function(err) {
          should.exist(err);
          err.message.should.equal(expectedErrMsg);
          cb();
        });
      }, done);
    });

    it('should return an error for instance.save', function(done) {
      var todo = new Todo();
      todo.content = 'Buy ham';
      todo.save(function(err) {
        should.exist(err);
        err.message.should.equal(expectedErrMsg);
        done();
      });
    });

    it('should return an error for instance.delete', function(done) {
      Todo.findOne(function(err, todo) {
        todo.delete(function(err) {
          should.exist(err);
          err.message.should.equal(expectedErrMsg);
          done();
        });
      });
    });

    it('should return an error for instance.updateAttribute', function(done) {
      Todo.findOne(function(err, todo) {
        todo.updateAttribute('content', 'Buy ham', function(err) {
          should.exist(err);
          err.message.should.equal(expectedErrMsg);
          done();
        });
      });
    });

    it('should return an error for instance.updateAttributes', function(done) {
      Todo.findOne(function(err, todo) {
        todo.updateAttributes({content: 'Buy ham'}, function(err) {
          should.exist(err);
          err.message.should.equal(expectedErrMsg);
          done();
        });
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
      addressLoc: {lat: 29.97, lng: -90.03},
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
      addressLoc: {lat: 22.97, lng: -88.03},
    },
    {
      seq: 2,
      name: 'George Harrison',
      birthday: null,
      order: 5,
      vip: false,
      addressLoc: {lat: 22.7, lng: -89.03},
    },
    {seq: 3, name: 'Ringo Starr', order: 6, birthday: null, vip: false},
    {seq: 4, name: 'Pete Best', order: 4, birthday: null},
    {seq: 5, name: 'Stuart Sutcliffe', order: 3, birthday: null, vip: true},
  ];

  async.series([
    User.destroyAll.bind(User),
    function(cb) {
      async.each(beatles, User.create.bind(User), cb);
    },
  ], done);
}

function nextAfterDelay(ctx, next) {
  var randomTimeoutTrigger = Math.floor(Math.random() * 100);
  setTimeout(function() { process.nextTick(next); }, randomTimeoutTrigger);
}
