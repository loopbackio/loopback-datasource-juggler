'use strict';

var assert = require('assert');
var utils = require('../utils');

/**
 * Get remaining expiration (TTL) for a given key.
 *
 * @param {String} key
 * @param {Object} options
 * @callback cb
 * @param {Error} error
 * @param {Number} ttl The remaining TTL for the given key. `undefined` if TTL
 *   was not initially set.
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
