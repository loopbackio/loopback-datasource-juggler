// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
var jdb = require('../');
var DataSource = jdb.DataSource;
var path = require('path');
var fs = require('fs');
var assert = require('assert');
var async = require('async');
var should = require('./init.js');
var Memory = require('../lib/connectors/memory').Memory;

describe('normalizeUndefinedInQuery', function() {
  describe('with setting "throw"', function() {
    var ds = new DataSource({
      connector: 'memory',
      normalizeUndefinedInQuery: 'throw',
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

    before(function(done) {
      seed(User, done);
    });

    it('should throw if find where contains undefined', function(done) {
      User.find({where: {name: undefined}}, function(err, users) {
        should.exist(err);
        done();
      });
    });

    it('should throw if destroyAll where contains undefined', function(done) {
      User.destroyAll({name: undefined}, function(err, count) {
        should.exist(err);
        done();
      });
    });

    it('should throw if updateAll where contains undefined', function(done) {
      User.updateAll({name: undefined}, {vip: false}, function(err, count) {
        should.exist(err);
        done();
      });
    });

    it('should throw if upsertWithWhere where contains undefined', function(done) {
      User.upsertWithWhere({name: undefined}, {vip: false}, function(err, count) {
        should.exist(err);
        done();
      });
    });

    it('should throw if count where contains undefined', function(done) {
      User.count({name: undefined}, function(err, count) {
        should.exist(err);
        done();
      });
    });
  });

  describe('with setting "nullify"', function() {
    var ds = new DataSource({
      connector: 'memory',
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
    }, {
      normalizeUndefinedInQuery: 'nullify',
    });

    before(function(done) {
      seed(User, done);
    });

    it('should nullify if find where contains undefined', function(done) {
      User.find({where: {role: undefined}}, function(err, users) {
        should.not.exist(err);
        users.length.should.eql(4);
        done();
      });
    });

    it('should nullify if updateAll where contains undefined', function(done) {
      User.updateAll({role: undefined}, {vip: false}, function(err, count) {
        should.not.exist(err);
        count.count.should.eql(4);
        done();
      });
    });

    it('should nullify if upsertWithWhere where contains undefined', function(done) {
      User.upsertWithWhere({role: undefined, order: 6}, {vip: false}, function(err, user) {
        should.not.exist(err);
        user.order.should.eql(6);
        done();
      });
    });

    it('should nullify if count where contains undefined', function(done) {
      User.count({role: undefined}, function(err, count) {
        should.not.exist(err);
        count.should.eql(4);
        done();
      });
    });

    it('should nullify if destroyAll where contains undefined', function(done) {
      User.destroyAll({role: undefined}, function(err, count) {
        should.not.exist(err);
        count.count.should.eql(4);
        done();
      });
    });
  });

  describe('with setting "ignore"', function() {
    var ds = new DataSource({
      connector: 'memory',
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
    }, {
      normalizeUndefinedInQuery: 'ignore',
    });

    before(function(done) {
      seed(User, done);
    });

    it('should ignore if find where contains undefined', function(done) {
      User.find({where: {role: undefined}}, function(err, users) {
        should.not.exist(err);
        users.length.should.eql(6);
        done();
      });
    });

    it('should ignore if updateAll where contains undefined', function(done) {
      User.updateAll({role: undefined}, {vip: false}, function(err, count) {
        should.not.exist(err);
        count.count.should.eql(6);
        done();
      });
    });

    it('should ignore if upsertWithWhere where contains undefined', function(done) {
      User.upsertWithWhere({role: undefined, order: 6}, {vip: false}, function(err, user) {
        should.not.exist(err);
        user.order.should.eql(6);
        done();
      });
    });

    it('should ignore if count where contains undefined', function(done) {
      User.count({role: undefined}, function(err, count) {
        should.not.exist(err);
        count.should.eql(6);
        done();
      });
    });

    it('should ignore if destroyAll where contains undefined', function(done) {
      User.destroyAll({role: undefined}, function(err, count) {
        should.not.exist(err);
        count.count.should.eql(6);
        done();
      });
    });
  });
});

function seed(User, done) {
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
        zipCode: '95131',
        tags: [{tag: 'business'}, {tag: 'rent'}],
      },
      friends: [{name: 'Paul McCartney'}, {name: 'George Harrison'}, {name: 'Ringo Starr'}],
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
      friends: [{name: 'John Lennon'}, {name: 'George Harrison'}, {name: 'Ringo Starr'}],
      children: ['Stella', 'Mary', 'Heather', 'Beatrice', 'James'],
    },
    {seq: 2, name: 'George Harrison', role: null, order: 5, vip: false, children: ['Dhani']},
    {seq: 3, name: 'Ringo Starr', role: null, order: 6, vip: false},
    {seq: 4, name: 'Pete Best', role: null, order: 4, children: []},
    {seq: 5, name: 'Stuart Sutcliffe', role: null, order: 3, vip: true},
  ];

  async.series(
    [
      User.destroyAll.bind(User),
      function(cb) {
        async.each(beatles, User.create.bind(User), cb);
      },
    ],
    done
  );
}
