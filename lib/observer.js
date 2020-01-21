// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const async = require('async');
const utils = require('./utils');
const debug = require('debug')('loopback:observer');

module.exports = ObserverMixin;

/**
 * ObserverMixin class. Use to add observe/notifyObserversOf APIs to other
 * classes.
 *
 * @class ObserverMixin
 */
function ObserverMixin() {
}

/**
 * Register an asynchronous observer for the given operation (event).
 *
 * Example:
 *
 * Registers a `before save` observer for a given model.
 *
 * ```javascript
 * MyModel.observe('before save', function filterProperties(ctx, next) {
  if (ctx.options && ctx.options.skipPropertyFilter) return next();
  if (ctx.instance) {
    FILTERED_PROPERTIES.forEach(function(p) {
      ctx.instance.unsetAttribute(p);
    });
  } else {
    FILTERED_PROPERTIES.forEach(function(p) {
      delete ctx.data[p];
    });
  }
  next();
});
 * ```
 *
 * @param {String} operation The operation name.
 * @callback {function} listener The listener function. It will be invoked with
 * `this` set to the model constructor, e.g. `User`.
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
 *
 * Example:
 *
 * ```javascript
 * MyModel.removeObserver('before save', function removedObserver(ctx, next) {
    // some logic user want to apply to the removed observer...
    next();
 });
 * ```
 *
 * @param {String} operation The operation name.
 * @callback {function} listener The listener function.
 * @end
 */
ObserverMixin.removeObserver = function(operation, listener) {
  if (!(this._observers && this._observers[operation])) return;

  const index = this._observers[operation].indexOf(listener);
  if (index !== -1) {
    return this._observers[operation].splice(index, 1);
  }
};

/**
 * Unregister all asynchronous observers for the given operation (event).
 *
 * Example:
 *
 * Remove all observers connected to the `before save` operation.
 *
 * ```javascript
 * MyModel.clearObservers('before save');
 * ```
 *
 * @param {String} operation The operation name.
 * @end
 */
ObserverMixin.clearObservers = function(operation) {
  if (!(this._observers && this._observers[operation])) return;

  this._observers[operation].length = 0;
};

/**
 * Invoke all async observers for the given operation(s).
 *
 * Example:
 *
 * Notify all async observers for the `before save` operation.
 *
 * ```javascript
 * var context = {
    Model: Model,
    instance: obj,
    isNewInstance: true,
    hookState: hookState,
    options: options,
 };
 * Model.notifyObserversOf('before save', context, function(err) {
    if (err) return cb(err);
    // user can specify the logic after the observers have been notified
 });
 * ```
 *
 * @param {String|String[]} operation The operation name(s).
 * @param {Object} context Operation-specific context.
 * @callback {function(Error=)} callback The callback to call when all observers
 *   have finished.
 */
ObserverMixin.notifyObserversOf = function(operation, context, callback) {
  const self = this;
  if (!callback) callback = utils.createPromiseCallback();

  function createNotifier(op) {
    return function(ctx, done) {
      if (typeof ctx === 'function' && done === undefined) {
        done = ctx;
        ctx = context;
      }
      self.notifyObserversOf(op, context, done);
    };
  }

  if (Array.isArray(operation)) {
    const tasks = [];
    for (let i = 0, n = operation.length; i < n; i++) {
      tasks.push(createNotifier(operation[i]));
    }
    return async.waterfall(tasks, callback);
  }

  const observers = this._observers && this._observers[operation];

  this._notifyBaseObservers(operation, context, function doNotify(err) {
    if (err) return callback(err, context);
    if (!observers || !observers.length) return callback(null, context);

    async.eachSeries(
      observers,
      function notifySingleObserver(fn, next) {
        const retval = fn(context, next);
        if (retval && typeof retval.then === 'function') {
          retval.then(
            function() { next(); return null; },
            next, // error handler
          );
        }
      },
      function(err) { callback(err, context); },
    );
  });
  return callback.promise;
};

ObserverMixin._notifyBaseObservers = function(operation, context, callback) {
  if (this.base && this.base.notifyObserversOf)
    this.base.notifyObserversOf(operation, context, callback);
  else
    callback();
};

/**
 * Run the given function with before/after observers.
 *
 * It's done in three serial asynchronous steps:
 *
 * - Notify the registered observers under 'before ' + operation
 * - Execute the function
 * - Notify the registered observers under 'after ' + operation
 *
 * If an error happens, it fails first and calls the callback with err.
 *
 * Example:
 *
 * ```javascript
 * var context = {
    Model: Model,
    instance: obj,
    isNewInstance: true,
    hookState: hookState,
    options: options,
 };
 * function work(done) {
   process.nextTick(function() {
      done(null, 1);
    });
  }
 * Model.notifyObserversAround('execute', context, work, function(err) {
    if (err) return cb(err);
    // user can specify the logic after the observers have been notified
 });
 * ```
 *
 * @param {String} operation The operation name
 * @param {Context} context The context object
 * @param {Function} fn The task to be invoked as fn(done) or fn(context, done)
 * @callback {Function} callback The callback function
 * @returns {*}
 */
ObserverMixin.notifyObserversAround = function(operation, context, fn, callback) {
  const self = this;
  context = context || {};
  // Add callback to the context object so that an observer can skip other
  // ones by calling the callback function directly and not calling next
  if (context.end === undefined) {
    context.end = callback;
  }
  // First notify before observers
  return self.notifyObserversOf('before ' + operation, context,
    function(err, context) {
      if (err) return callback(err);

      function cbForWork(err) {
        const args = [].slice.call(arguments, 0);
        if (err) {
          // call observer in case of error to hook response
          context.error = err;
          self.notifyObserversOf('after ' + operation + ' error', context,
            function(_err, context) {
              if (_err && err) {
                debug(
                  'Operation %j failed and "after %s error" hook returned an error too. ' +
                    'Calling back with the hook error only.' +
                    '\nOriginal error: %s\nHook error: %s\n',
                  err.stack || err,
                  _err.stack || _err,
                );
              }
              callback.call(null, _err || err, context);
            });
          return;
        }
        // Find the list of params from the callback in addition to err
        const returnedArgs = args.slice(1);
        // Set up the array of results
        context.results = returnedArgs;
        // Notify after observers
        self.notifyObserversOf('after ' + operation, context,
          function(err, context) {
            if (err) return callback(err, context);
            let results = returnedArgs;
            if (context && Array.isArray(context.results)) {
              // Pickup the results from context
              results = context.results;
            }
            // Build the list of params for final callback
            const args = [err].concat(results);
            callback.apply(null, args);
          });
      }

      if (fn.length === 1) {
        // fn(done)
        fn(cbForWork);
      } else {
        // fn(context, done)
        fn(context, cbForWork);
      }
    });
};
