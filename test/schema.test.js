// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
const should = require('./init.js');

const db = getSchema();
const slave = getSchema();
let Model, SlaveModel;

describe('dataSource', function() {
  it('should define Model', function() {
    Model = db.define('Model');
    Model.dataSource.should.eql(db);
    const m = new Model;
    m.getDataSource().should.eql(db);
  });

  it('should clone existing model', function() {
    SlaveModel = slave.copyModel(Model);
    SlaveModel.dataSource.should.equal(slave);
    slave.should.not.equal(db);
    const sm = new SlaveModel;
    sm.should.be.instanceOf(Model);
    sm.getDataSource().should.not.equal(db);
    sm.getDataSource().should.equal(slave);
  });

  it('should automigrate', function(done) {
    db.automigrate(done);
  });

  it('should create transaction', function(done) {
    const tr = db.transaction();
    tr.connected.should.be.false;
    tr.connecting.should.be.false;
    let called = false;
    tr.models.Model.create(Array(3), function() {
      called = true;
    });
    tr.connected.should.be.false;
    tr.connecting.should.be.true;

    db.models.Model.count(function(err, c) {
      should.not.exist(err);
      should.exist(c);
      c.should.equal(0);
      called.should.be.false;
      tr.exec(function() {
        setTimeout(function() {
          called.should.be.true;
          db.models.Model.count(function(err, c) {
            c.should.equal(3);
            done();
          });
        }, 100);
      });
    });
  });
});
