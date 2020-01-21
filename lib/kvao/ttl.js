// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const assert = require('assert');
const utils = require('../utils');

/**
 * Return the TTL (time to live) for a given key. TTL is the remaining time
 * before a key-value pair is discarded from the database.
 *
 * @param {String} key Key to use when searching the database.
 * @options {Object} options
 * @callback {Function} callback
 * @param {Error} error
 * @param {Number} ttl Expiration time for the key-value pair. `undefined` if
 *   TTL was not initially set.
 * @promise
 *
 * @header KVAO.ttl(key, cb)
 */
module.exports = function keyValueTtl(key, options, callback) {
  if (callback == undefined && typeof options === 'function') {
    callback = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  assert(typeof key === 'string' && key, 'key must be a non-empty string');
  assert(typeof options === 'object', 'options must be an object');

  callback = callback || utils.createPromiseCallback();
  this.getConnector().ttl(this.modelName, key, options, callback);
  return callback.promise;
};
