'use strict';

var assert = require('assert');
var utils = require('../utils');

/**
 * Asynchronously iterate all keys.
 *
 * @param {Object} filter An optional filter object with the following
 * properties:
 *  - `match` - glob string to use to filter returned keys, e.g. 'userid.*'
 *    All connectors are required to support `*` and `?`.
 *    They may also support additional special characters that are specific
 *    to the backing store.
 *
 * @param {Object} options
 *
 * @returns {AsyncIterator} An object implementing "next(cb) -> Promise"
 * function that can be used to iterate all keys.
 *
 * @header KVAO.iterateKeys(filter)
 */
module.exports = function keyValueIterateKeys(filter, options) {
  filter = filter || {};
  options = options || {};

  assert(typeof filter === 'object', 'filter must be an object');
  assert(typeof options === 'object', 'options must be an object');

  var iter = this.getConnector().iterateKeys(this.modelName, filter, options);
  // promisify the returned iterator
  return {
    next: function(callback) {
      callback = callback || utils.createPromiseCallback();
      iter.next(callback);
      return callback.promise;
    },
  };
};
