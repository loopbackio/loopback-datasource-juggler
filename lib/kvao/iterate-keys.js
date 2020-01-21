// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const assert = require('assert');
const utils = require('../utils');

/**
 * Asynchronously iterate all keys in the database. Similar to `.keys()` but
 * instead allows for iteration over large data sets without having to load
 * everything into memory at once.
 *
 * @param {Object} filter An optional filter object with the following
 * @param {String} filter.match Glob string to use to filter returned
 *   keys (i.e. `userid.*`). All connectors are required to support `*` and
 *   `?`. They may also support additional special characters that are
 *   specific to the backing database.
 * @param {Object} options
 * @returns {AsyncIterator} An Object implementing `next(cb) -> Promise`
 *   function that can be used to iterate all keys.
 *
 * @header KVAO.iterateKeys(filter)
 */
module.exports = function keyValueIterateKeys(filter, options) {
  filter = filter || {};
  options = options || {};

  assert(typeof filter === 'object', 'filter must be an object');
  assert(typeof options === 'object', 'options must be an object');

  const iter = this.getConnector().iterateKeys(this.modelName, filter, options);
  // promisify the returned iterator
  return {
    next: function(callback) {
      callback = callback || utils.createPromiseCallback();
      iter.next(callback);
      return callback.promise;
    },
  };
};
