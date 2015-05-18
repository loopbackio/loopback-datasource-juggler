var async = require('async');
var utils = require('./utils');

module.exports = ObserverMixin;

/**
 * ObserverMixin class.  Use to add observe/notifyObserversOf APIs to other
 * classes.
 *
 * @class ObserverMixin
 */
function ObserverMixin() {
}

/**
 * Register an asynchronous observer for the given operation (event).
 * @param {String} operation The operation name.
 * @callback {function} listener The listener function. It will be invoked with
 * `this` set to the model constructor, e.g. `User`.
 * @param {Object} context Operation-specific context.
 * @param {function(Error=)} next The callback to call when the observer
 *   has finished.
 * @end
 */
ObserverMixin.observe = function(operation, listener) {
  this._observers = this._observers || {};
  if (!this._observers[operation]) {
    this._observers[operation] = [];
  }

  this._observers[operation].push(listener);
};

/**
 * Unregister an asynchronous observer for the given operation (event).
 * @param {String} operation The operation name.
 * @callback {function} listener The listener function.
 * @end
 */
ObserverMixin.removeObserver = function(operation, listener) {
  if (!(this._observers && this._observers[operation])) return;

  var index = this._observers[operation].indexOf(listener);
  if (index !== -1) {
    return this._observers[operation].splice(index, 1);
  }
};

/**
 * Unregister all asynchronous observers for the given operation (event).
 * @param {String} operation The operation name.
 * @end
 */
ObserverMixin.clearObservers = function(operation) {
  if (!(this._observers && this._observers[operation])) return;

  this._observers[operation].length = 0;
};

/**
 * Invoke all async observers for the given operation.
 * @param {String} operation The operation name.
 * @param {Object} context Operation-specific context.
 * @param {function(Error=)} callback The callback to call when all observers
 *   has finished.
 */
ObserverMixin.notifyObserversOf = function(operation, context, callback) {
  var observers = this._observers && this._observers[operation];

  if (!callback) callback = utils.createPromiseCallback();

  this._notifyBaseObservers(operation, context, function doNotify(err) {
    if (err) return callback(err, context);
    if (!observers || !observers.length) return callback(null, context);

    async.eachSeries(
      observers,
      function notifySingleObserver(fn, next) {
        var retval = fn(context, next);
        if (retval && typeof retval.then === 'function') {
          retval.then(
            function() { next(); },
            next // error handler
          );
        }
      },
      function(err) { callback(err, context) }
    );
  });
  return callback.promise;
}

ObserverMixin._notifyBaseObservers = function(operation, context, callback) {
  if (this.base && this.base.notifyObserversOf)
    this.base.notifyObserversOf(operation, context, callback);
  else
    callback();
}
