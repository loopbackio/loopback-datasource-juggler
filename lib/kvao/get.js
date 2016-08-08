'use strict';

var assert = require('assert');
var utils = require('../utils');

/**
 * Get the value stored for the given key.
 *
 * @param {String} key
 * @callback cb
 * @param {Error} error
 * @param {*} value
 *
 * @header KVAO.get(key, cb)
 */
module.exports = function keyValueGet(key, options, callback) {
  if (callback == undefined && typeof options === 'function') {
    callback = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  assert(typeof key === 'string' && key, 'key must be a non-empty string');

  callback = callback || utils.createPromiseCallback();
  this.getConnector().get(this.modelName, key, options, function(err, result) {
    // TODO convert raw result to Model instance (?)
    callback(err, result);
  });
  return callback.promise;
};
