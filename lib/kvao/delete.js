'use strict';

var assert = require('assert');
var utils = require('../utils');

/**
 * Delete the key-value pair associated to the given key.
 *
 * @param {String} key Key to use when searching the database.
 * @options {Object} options
 * @callback {Function} callback
 * @param {Error} err Error object.
 * @param {*} result Value associated with the given key.
 * @promise
 *
 * @header KVAO.prototype.delete(key[, options], cb)
 */
module.exports = function keyValueDelete(key, options, callback) {
  if (callback == undefined && typeof options === 'function') {
    callback = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  assert(typeof key === 'string' && key, 'key must be a non-empty string');

  callback = callback || utils.createPromiseCallback();
  this.getConnector().delete(this.modelName, key, options, callback);
  return callback.promise;
};
