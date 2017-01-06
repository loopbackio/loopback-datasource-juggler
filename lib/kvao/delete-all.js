'use strict';

var assert = require('assert');
var utils = require('../utils');

/**
 * Delete all keys (and values) associated to the current model.
 *
 * @options {Object} options Unused ATM, placeholder for future options.
 * @callback {Function} callback
 * @param {Error} err Error object.
 * @promise
 *
 * @header KVAO.prototype.deleteAll(options, cb)
 */
module.exports = function deleteAll(options, callback) {
  if (callback == undefined && typeof options === 'function') {
    callback = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  assert(typeof options === 'object', 'options must be an object');

  callback = callback || utils.createPromiseCallback();

  this.getConnector().deleteAll(this.modelName, options, callback);
  return callback.promise;
};
