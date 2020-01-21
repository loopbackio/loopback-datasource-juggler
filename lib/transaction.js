// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const g = require('strong-globalize')();
const debug = require('debug')('loopback:connector:transaction');
const uuid = require('uuid');
const utils = require('./utils');
const jutil = require('./jutil');
const ObserverMixin = require('./observer');

const Transaction = require('loopback-connector').Transaction;

module.exports = TransactionMixin;

/**
 * TransactionMixin class.  Use to add transaction APIs to a model class.
 *
 * @class TransactionMixin
 */
function TransactionMixin() {
}

/**
 * Begin a new transaction.
 *
 * A transaction can be committed or rolled back. If timeout happens, the
 * transaction will be rolled back. Please note a transaction is typically
 * associated with a pooled connection. Committing or rolling back a transaction
 * will release the connection back to the pool.
 *
 * Once the transaction is committed or rolled back, the connection property
 * will be set to null to mark the transaction to be inactive. Trying to commit
 * or rollback an inactive transaction will receive an error from the callback.
 *
 * Please also note that the transaction is only honored with the same data
 * source/connector instance. CRUD methods will not join the current transaction
 * if its model is not attached the same data source.
 *
 * Example:
 *
 * To pass the transaction context to one of the CRUD methods, use the `options`
 * argument with `transaction` property, for example,
 *
 * ```js
 * MyModel.beginTransaction('READ COMMITTED', function(err, tx) {
 *   MyModel.create({x: 1, y: 'a'}, {transaction: tx}, function(err, inst) {
 *     MyModel.find({x: 1}, {transaction: tx}, function(err, results) {
 *       // ...
 *       tx.commit(function(err) {...});
 *     });
 *   });
 * });
 * ```
 *
 * @param {Object|String} options Options to be passed upon transaction.
 *
 * Can be one of the forms:
 *  - Object: {isolationLevel: '...', timeout: 1000}
 *  - String: isolationLevel
 *
 * Valid values of `isolationLevel` are:
 *
 * - Transaction.READ_COMMITTED = 'READ COMMITTED'; // default
 * - Transaction.READ_UNCOMMITTED = 'READ UNCOMMITTED';
 * - Transaction.SERIALIZABLE = 'SERIALIZABLE';
 * - Transaction.REPEATABLE_READ = 'REPEATABLE READ';
 * @callback {Function} cb Callback function.
 * @returns {Promise|undefined} Returns a callback promise.
 */
TransactionMixin.beginTransaction = function(options, cb) {
  cb = cb || utils.createPromiseCallback();
  if (Transaction) {
    const connector = this.getConnector();
    Transaction.begin(connector, options, function(err, transaction) {
      if (err) return cb(err);
      // NOTE(lehni) As part of the process of moving the handling of
      // transaction id and timeout from TransactionMixin.beginTransaction() to
      // Transaction.begin() in loopback-connector, switch to only setting id
      // and timeout if it wasn't taken care of already by Transaction.begin().
      // Eventually, we can remove the following two if-blocks altogether.
      if (!transaction.id) {
        // Set an informational transaction id
        transaction.id = uuid.v1();
      }
      if (options.timeout && !transaction.timeout) {
        transaction.timeout = setTimeout(function() {
          const context = {
            transaction: transaction,
            operation: 'timeout',
          };
          transaction.notifyObserversOf('timeout', context, function(err) {
            if (!err) {
              transaction.rollback(function() {
                debug('Transaction %s is rolled back due to timeout',
                  transaction.id);
              });
            }
          });
        }, options.timeout);
      }
      cb(err, transaction);
    });
  } else {
    process.nextTick(function() {
      const err = new Error(g.f('{{Transaction}} is not supported'));
      cb(err);
    });
  }
  return cb.promise;
};

// Promisify the transaction apis
if (Transaction) {
  jutil.mixin(Transaction.prototype, ObserverMixin);
  /**
   * Commit a transaction and release it back to the pool.
   *
   * Example:
   *
   * ```js
   * MyModel.beginTransaction('READ COMMITTED', function(err, tx) {
   *   // some crud operation of your choice
   *   tx.commit(function(err) {
   *     // release the connection pool upon committing
   *     tx.close(err);
   *   });
   * });
   * ```
   *
   * @callback {Function} cb Callback function.
   * @returns {Promise|undefined} Returns a callback promise.
   */
  Transaction.prototype.commit = function(cb) {
    cb = cb || utils.createPromiseCallback();
    if (this.ensureActive(cb)) {
      const context = {
        transaction: this,
        operation: 'commit',
      };
      this.notifyObserversAround('commit', context,
        done => {
          this.connector.commit(this.connection, done);
        },
        err => {
          // Deference the connection to mark the transaction is not active
          // The connection should have been released back the pool
          this.connection = null;
          cb(err);
        });
    }
    return cb.promise;
  };

  /**
   * Rollback a transaction and release it back to the pool.
   *
   *  Example:
   *
   * ```js
   * MyModel.beginTransaction('READ COMMITTED', function(err, tx) {
   *   // some crud operation of your choice
   *   tx.rollback(function(err) {
   *     // release the connection pool upon committing
   *     tx.close(err);
   *   });
   * });
   * ```
   *
   * @callback {Function} cb Callback function.
   * @returns {Promise|undefined} Returns a callback promise.
   */
  Transaction.prototype.rollback = function(cb) {
    cb = cb || utils.createPromiseCallback();
    if (this.ensureActive(cb)) {
      const context = {
        transaction: this,
        operation: 'rollback',
      };
      this.notifyObserversAround('rollback', context,
        done => {
          this.connector.rollback(this.connection, done);
        },
        err => {
          // Deference the connection to mark the transaction is not active
          // The connection should have been released back the pool
          this.connection = null;
          cb(err);
        });
    }
    return cb.promise;
  };

  Transaction.prototype.ensureActive = function(cb) {
    // Report an error if the transaction is not active
    if (!this.connection) {
      process.nextTick(() => {
        cb(new Error(g.f('The {{transaction}} is not active: %s', this.id)));
      });
    }
    return !!this.connection;
  };

  Transaction.prototype.toJSON = function() {
    return this.id;
  };

  Transaction.prototype.toString = function() {
    return this.id;
  };
}

TransactionMixin.Transaction = Transaction;
