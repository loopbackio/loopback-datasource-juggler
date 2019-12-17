// Copyright IBM Corp. 2013,2016. All Rights Reserved.
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

  it('should apply defaults on read', function(done) {
    db.defineProperty('Server', 'host', {
      type: String,
      default: 'localhost',
    });
    Server.all(function(err, servers) {
      (new String('localhost')).should.equal(servers[0].host);
      done();
    });
  });

  it('should ignore defaults with limited fields', function(done) {
    Server.create({host: 'localhost', port: 8080}, function(err, s) {
      should.not.exist(err);
      s.port.should.equal(8080);
      Server.find({fields: ['host']}, function(err, servers) {
        servers[0].host.should.equal('localhost');
        servers[0].should.have.property('host');
        servers[0].should.have.property('port', undefined);
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

  context('applyDefaultOnWrites', function() {
    it('does not affect default behavior when not set', async () => {
      const Apple = db.define('Apple', {
        color: {type: String, default: 'red'},
        taste: {type: String, default: 'sweet'},
      }, {applyDefaultsOnReads: false});

      const apple = await Apple.create();
      apple.color.should.equal('red');
      apple.taste.should.equal('sweet');
    });

    it('removes the property when set to `false`', async () => {
      const Apple = db.define('Apple', {
        color: {type: String, default: 'red', applyDefaultOnWrites: false},
        taste: {type: String, default: 'sweet'},
      }, {applyDefaultsOnReads: false});

      const apple = await Apple.create({color: 'red', taste: 'sweet'});
      const found = await Apple.findById(apple.id);
      should(found.color).be.undefined();
      found.taste.should.equal('sweet');
    });

    it('removes nested property in an object when set to `false`', async () => {
      const Apple = db.define('Apple', {
        name: {type: String},
        qualities: {
          color: {type: String, default: 'red', applyDefaultOnWrites: false},
          taste: {type: String, default: 'sweet'},
        },
      }, {applyDefaultsOnReads: false});

      const apple = await Apple.create({name: 'Honeycrisp', qualities: {taste: 'sweet'}});
      const found = await Apple.findById(apple.id);
      should(found.qualities.color).be.undefined();
      found.qualities.taste.should.equal('sweet');
    });

    it('removes nested property in an array when set to `false', async () => {
      const Apple = db.define('Apple', {
        name: {type: String},
        qualities: [
          {color: {type: String, default: 'red', applyDefaultOnWrites: false}},
          {taste: {type: String, default: 'sweet'}},
        ],
      }, {applyDefaultsOnReads: false});

      const apple = await Apple.create({name: 'Honeycrisp', qualities: [{taste: 'sweet'}]});
      const found = await Apple.findById(apple.id);
      should(found.qualities[0].color).be.undefined();
      found.qualities.length.should.equal(1);
    });
  });

  context('persistDefaultValues', function() {
    it('removes property if value matches default', async () => {
      const Apple = db.define('Apple', {
        color: {type: String, default: 'red', persistDefaultValues: false},
        taste: {type: String, default: 'sweet'},
      }, {applyDefaultsOnReads: false});

      const apple = await Apple.create({color: 'red', taste: 'sweet'});
      const found = await Apple.findById(apple.id);
      should(found.color).be.undefined();
      found.taste.should.equal('sweet');
    });

    it('removes property if value matches default in an object', async () => {
      const Apple = db.define('Apple', {
        name: {type: String},
        qualities: {
          color: {type: String, default: 'red', persistDefaultValues: false},
          taste: {type: String, default: 'sweet'},
        },
      }, {applyDefaultsOnReads: false});

      const apple = await Apple.create({name: 'Honeycrisp', qualities: {taste: 'sweet'}});
      const found = await Apple.findById(apple.id);
      should(found.qualities.color).be.undefined();
      found.qualities.taste.should.equal('sweet');
    });

    it('removes property if value matches default in an array', async () => {
      const Apple = db.define('Apple', {
        name: {type: String},
        qualities: [
          {color: {type: String, default: 'red', persistDefaultValues: false}},
          {taste: {type: String, default: 'sweet'}},
        ],
      }, {applyDefaultsOnReads: false});

      const apple = await Apple.create({name: 'Honeycrisp', qualities: [{taste: 'sweet'}]});
      const found = await Apple.findById(apple.id);
      should(found.qualities[0].color).be.undefined();
      found.qualities.length.should.equal(1);
    });
  });
});
