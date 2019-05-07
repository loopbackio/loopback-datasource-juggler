// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
const should = require('./init.js');

const db = getSchema();

describe('defaults', function() {
  let Server;

  before(function() {
    Server = db.define('Server', {
      host: String,
      port: {type: Number, default: 80},
      createdAt: {type: Date, default: '$now'},
    });
  });

  it('should apply defaults on new', function() {
    const s = new Server;
    s.port.should.equal(80);
  });

  it('should apply defaults on create', function(done) {
    Server.create(function(err, s) {
      s.port.should.equal(80);
      done();
    });
  });

  it('should NOT apply defaults on read', function(done) {
    db.defineProperty('Server', 'host', {
      type: String,
      default: 'localhost',
    });
    Server.all(function(err, servers) {
      should(servers[0].host).be.undefined();
      done();
    });
  });

  it('should ignore defaults with limited fields', function(done) {
    Server.create({host: 'localhost', port: 8080}, function(err, s) {
      should.not.exist(err);
      s.port.should.equal(8080);
      Server.findById(s.id, {fields: ['host']}, function(err, server) {
        server.should.have.property('host', 'localhost');
        server.should.have.property('port', undefined);
        done();
      });
    });
  });

  it('should apply defaults in upsert create', function(done) {
    Server.upsert({port: 8181}, function(err, server) {
      should.not.exist(err);
      should.exist(server.createdAt);
      done();
    });
  });

  it('should preserve defaults in upsert update', function(done) {
    Server.findOne({}, function(err, server) {
      Server.upsert({id: server.id, port: 1337}, function(err, s) {
        should.not.exist(err);
        (Number(1337)).should.equal(s.port);
        server.createdAt.should.eql(s.createdAt);
        done();
      });
    });
  });
});
