// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false, connectorCapabilities:false */
var should = require('./init.js');

var db, Model;

describe('basic-querying', function() {
  before(function(done) {
    var modelDef = {
      'nested': {
        'duration': Number,
        'happenedOn': Date,
      },
    };

    db = getSchema();
    Model = db.define('Model', modelDef);
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

  describe('find', function() {
    before(function(done) {
      db = getSchema();
      Model.destroyAll(done);
    });

    it('should query by nested Date: found', function(done) {
      Model.create({
        nested: {
          duration: 2,
          happenedOn: '2017-10-30T06:07:31.805Z',
        },
      }, function(err, m) {
        should.not.exist(err);
        should.exist(m.id);
        console.log(m);
        Model.find({
          where: {
            'nested.happenedOn': {
              'gt': new Date('2017-10-20T06:07:31.805Z'),
            },
          },
        }, function(err, m) {
          should.not.exist(err);
          should.exist(m);
          console.log(m);
          m.should.not.be.empty();
          m[0].should.be.an.instanceOf(Model);
          done();
        });
      });
    });
  });
});
