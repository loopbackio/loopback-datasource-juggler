'use strict';

const assert = require('assert');
const utils = require('../utils');

/**
 * Persist a value and associate it with the given key.
 *
 * @param {String} key Key to associate with the given value.
 * @param {*} value Value to persist.
 * @options {Number|Object} options Optional settings for the key-value
 *   pair. If a Number is provided, it is set as the TTL (time to live) in ms
 *   (milliseconds) for the key-value pair.
 * @property {Number} ttl TTL for the key-value pair in ms.
 * @callback {Function} callback
 * @param {Error} err Error object.
 * @promise
 *
 * @header KVAO.set(key, value, cb)
 */
module.exports = function keyValueSet(key, value, options, callback) {
  if (callback == undefined && typeof options === 'function') {
    callback = options;
    options = {};
  } else if (typeof options === 'number') {
    options = {ttl: options};
  } else if (!options) {
    options = {};
  }

  assert(typeof key === 'string' && key, 'key must be a non-empty string');
  assert(value != null, 'value must be defined and not null');
  assert(typeof options === 'object', 'options must be an object');
  if (options && 'ttl' in options) {
    assert(typeof options.ttl === 'number' && options.ttl > 0,
      'options.ttl must be a positive number');
  }

  callback = callback || utils.createPromiseCallback();

  // TODO convert possible model instance in "value" to raw data via toObect()
  this.getConnector().set(this.modelName, key, value, options, callback);
  return callback.promise;
};
