'use strict';

var assert = require('assert');
var utils = require('../utils');

/**
 * Set the TTL (time to live) in ms (milliseconds) for a given key. TTL is the
 * remaining time before a key-value pair is discarded from the database.
 *
 * @param {String} key Key to use when searching the database.
 * @param {Number} ttl TTL in ms to set for the key.
 * @options {Object} options
 * @callback {Function} callback
 * @param {Error} err Error object.
 * @promise
 *
 * @header KVAO.expire(key, ttl, cb)
 */
module.exports = function keyValueExpire(key, ttl, options, callback) {
  if (callback == undefined && typeof options === 'function') {
    callback = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  // FIXME [superkhau]: Check for ttl property if ttl is an object. API explorer
  // passes in an object (because PUT requests are not submitting form data). I
  // believe it is related to
  // https://github.com/strongloop/loopback-component-explorer/issues/176.
  if (typeof ttl === 'object') {
    ttl = ttl.ttl;
  }

  assert(typeof key === 'string' && key, 'key must be a non-empty string');
  assert(typeof ttl === 'number' && ttl > 0, 'ttl must be a positive integer');
  assert(typeof options === 'object', 'options must be an object');

  callback = callback || utils.createPromiseCallback();
  this.getConnector().expire(this.modelName, key, ttl, options, callback);
  return callback.promise;
};
