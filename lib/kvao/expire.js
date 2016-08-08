'use strict';

var assert = require('assert');
var utils = require('../utils');

/**
 * Set expiration (TTL) for the given key.
 *
 * @param {String} key
 * @param {Number} ttl
 * @param {Object} options
 * @callback cb
 * @param {Error} error
 *
 * @header KVAO.get(key, cb)
 */
module.exports = function keyValueExpire(key, ttl, options, callback) {
  if (callback == undefined && typeof options === 'function') {
    callback = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  assert(typeof key === 'string' && key, 'key must be a non-empty string');
  assert(typeof ttl === 'number' && ttl > 0, 'ttl must be a positive integer');
  assert(typeof options === 'object', 'options must be an object');

  callback = callback || utils.createPromiseCallback();
  this.getConnector().expire(this.modelName, key, ttl, options, callback);
  return callback.promise;
};

