// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
/* global getSchema:false */
const DataSource = require('..').DataSource;
const EventEmitter = require('events');
const Connector = require('loopback-connector').Connector;
const Transaction = require('loopback-connector').Transaction;
const should = require('./init.js');

describe('Transactions on memory connector', function() {
  let db, tx;

  before(() => {
    db = getSchema();
    db.define('Model');
  });

  it('returns an EventEmitter object', done => {
    tx = db.transaction();
    tx.should.be.instanceOf(EventEmitter);
    done();
  });

  it('exposes and caches slave models', done => {
    testModelCaching(tx.models, db.models);
    done();
  });

  it('changes count when committing', done => {
    db.models.Model.count((err, count) => {
      should.not.exist(err);
      should.exist(count);
      count.should.equal(0);
      tx.models.Model.create(Array(1), () => {
        // Only called after tx.commit()!
      });
      tx.commit(err => {
        should.not.exist(err);
        db.models.Model.count((err, count) => {
          should.not.exist(err);
          should.exist(count);
          count.should.equal(1);
          done();
        });
      });
    });
  });
});

describe('Transactions on test connector without execute()', () => {
  let db, tx;

  before(() => {
    db = createDataSource();
  });

  beforeEach(resetState);

  it('resolves to an EventEmitter', done => {
    const promise = db.transaction();
    promise.should.be.Promise();
    promise.then(transaction => {
      should.exist(transaction);
      transaction.should.be.instanceof(EventEmitter);
      tx = transaction;
      done();
    }, done);
  });

  it('exposes and caches slave models', done => {
    testModelCaching(tx.models, db.models);
    done();
  });

  it('does not allow nesting of transactions', done => {
    (() => tx.transaction()).should.throw('Nesting transactions is not supported');
    done();
  });

  it('calls commit() on the connector', done => {
    db.transaction().then(tx => {
      tx.commit(err => {
        callCount.should.deepEqual({commit: 1, rollback: 0, create: 0});
        done(err);
      });
    }, done);
  });

  it('calls rollback() on the connector', done => {
    db.transaction().then(tx => {
      tx.rollback(err => {
        callCount.should.deepEqual({commit: 0, rollback: 1, create: 0});
        done(err);
      });
    }, done);
  });
});

describe('Transactions on test connector with execute()', () => {
  let db;

  before(() => {
    db = createDataSource();
  });

  beforeEach(resetState);

  it('passes models and calls commit() automatically', done => {
    db.transaction(models => {
      testModelCaching(models, db.models);
      return models.Model.create({});
    }, err => {
      callCount.should.deepEqual({commit: 1, rollback: 0, create: 1});
      transactionPassed.should.be.true();
      done(err);
    });
  });

  it('calls rollback() automatically when throwing an error', done => {
    let error;
    db.transaction(models => {
      error = new Error('exception');
      throw error;
    }, err => {
      error.should.equal(err);
      callCount.should.deepEqual({commit: 0, rollback: 1, create: 0});
      done();
    });
  });

  it('reports execution timeouts', done => {
    let timedOut = false;
    db.transaction(models => {
      setTimeout(() => {
        models.Model.create({}, function(err) {
          if (!timedOut) {
            done(new Error('Timeout was ineffective'));
          } else {
            should.exist(err);
            err.message.should.startWith('The transaction is not active:');
            done();
          }
        });
      }, 50);
    }, {
      timeout: 25,
    }, err => {
      timedOut = true;
      should.exist(err);
      err.code.should.equal('TRANSACTION_TIMEOUT');
      err.message.should.equal('Transaction is rolled back due to timeout');
      callCount.should.deepEqual({commit: 0, rollback: 1, create: 0});
    });
  });
});

function createDataSource() {
  const db = new DataSource({
    initialize: (dataSource, cb) => {
      dataSource.connector = new TestConnector();
      cb();
    },
  });
  db.define('Model');
  return db;
}

function testModelCaching(txModels, dbModels) {
  should.exist(txModels);
  // Test models caching mechanism:
  // Model property should be a accessor with a getter first:
  const accessor = Object.getOwnPropertyDescriptor(txModels, 'Model');
  should.exist(accessor);
  should.exist(accessor.get);
  accessor.get.should.be.Function();
  const Model = txModels.Model;
  should.exist(Model);
  // After accessing it once, it should be a normal cached property:
  const desc = Object.getOwnPropertyDescriptor(txModels, 'Model');
  should.exist(desc.value);
  Model.should.equal(txModels.Model);
  Model.prototype.should.be.instanceof(dbModels.Model);
}

let callCount;
let transactionPassed;

function resetState() {
  callCount = {commit: 0, rollback: 0, create: 0};
  transactionPassed = false;
}

class TestConnector extends Connector {
  constructor() {
    super('test');
  }

  beginTransaction(isolationLevel, cb) {
    this.currentTransaction = new Transaction(this, this);
    process.nextTick(() => cb(null, this.currentTransaction));
  }

  commit(tx, cb) {
    callCount.commit++;
    cb();
  }

  rollback(tx, cb) {
    callCount.rollback++;
    cb();
  }

  create(model, data, options, cb) {
    callCount.create++;
    const transaction = options.transaction;
    const current = this.currentTransaction;
    transactionPassed = transaction &&
      (current === transaction || current === transaction.connection);
    cb();
  }
}
