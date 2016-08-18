'use strict';

var assert = require('assert');
var utils = require('../utils');

/**
 * Get all keys.
 *
 * **NOTE**
 * Building an in-memory array of all keys may be expensive.
 * Consider using `iterateKeys` instead.
 *
 * @param {Object} filter An optional filter object with the following
 * properties:
 *  - `match` - glob string to use to filter returned keys, e.g. 'userid.*'
 *    All connectors are required to support `*` and `?`.
 *    They may also support additional special characters that are specific
 *    to the backing store.
 * @param {Object} options
 * @callback callback
 * @param {Error=} err
 * @param {[String]} keys The list of keys.
 *
 * @promise
 *
 * @header KVAO.keys(filter, callback)
 */
module.exports = function keyValueKeys(filter, options, callback) {
  if (callback === undefined) {
    if (typeof options === 'function') {
      callback = options;
      options = undefined;
    } else if (options === undefined && typeof filter === 'function') {
      callback = filter;
      filter = undefined;
    }
  }

  filter = filter || {};
  options = options || {};

  assert(typeof filter === 'object', 'filter must be an object');
  assert(typeof options === 'object', 'options must be an object');

  callback = callback || utils.createPromiseCallback();

  var iter = this.iterateKeys(filter, options);
  var keys = [];
  iter.next(onNextKey);

  function onNextKey(err, key) {
    if (err) return callback(err);
    if (key === undefined) return callback(null, keys);
    keys.push(key);
    iter.next(onNextKey);
  }

  return callback.promise;
};

