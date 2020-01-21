// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const assert = require('assert');
const utils = require('../utils');

/**
 * Return all keys in the database.
 *
 * **WARNING**: This method is not suitable for large data sets as all
 * key-values pairs are loaded into memory at once. For large data sets,
 * use `iterateKeys()` instead.
 *
 * @param {Object} filter An optional filter object with the following
 * @param {String} filter.match Glob string used to filter returned
 *   keys (i.e. `userid.*`). All connectors are required to support `*` and
 *   `?`, but may also support additional special characters specific to the
 *   database.
 * @param {Object} options
 * @callback {Function} callback
 * @promise
 *
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

  const iter = this.iterateKeys(filter, options);
  const keys = [];
  iter.next(onNextKey);

  function onNextKey(err, key) {
    if (err) return callback(err);
    if (key === undefined) return callback(null, keys);
    keys.push(key);
    iter.next(onNextKey);
  }

  return callback.promise;
};
