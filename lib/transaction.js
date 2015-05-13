var Transaction = require('loopback-connector').Transaction;

module.exports = TransactionMixin;

function TransactionMixin() {
}

/**
 * Begin a new transaction
 * @param {Object|String} [options] Options can be one of the forms:
 * - Object: {isolationLevel: '...', timeout: 1000}
 * - String: isolationLevel
 *
 * Valid values of `isolationLevel` are:
 *
 * - Transaction.READ_COMMITTED = 'READ COMMITTED'; // default
 * - Transaction.READ_UNCOMMITTED = 'READ UNCOMMITTED';
 * - Transaction.SERIALIZABLE = 'SERIALIZABLE';
 * - Transaction.REPEATABLE_READ = 'REPEATABLE READ';
 *
 * @param {Function} cb Callback function. It calls back with (err, transaction).
 * To pass the transaction context to one of the CRUD methods, use the `options`
 * argument with `transaction` property, for example,
 *
 * ```js
 *
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
 * The transaction can be committed or rolled back. If timeout happens, the
 * transaction will be rolled back. Please note a transaction is typically
 * associated with a pooled connection. Committing or rolling back a transaction
 * will release the connection back to the pool.
 *
 */
TransactionMixin.beginTransaction = function(options, cb) {
  if (Transaction) {
    var connector = this.getConnector();
    Transaction.begin(connector, options, cb);
  } else {
    process.nextTick(function() {
      var err = new Error('Transaction is not supported');
      cb(err);
    });
  }
};


