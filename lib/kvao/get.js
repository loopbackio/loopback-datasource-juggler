// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const assert = require('assert');
const utils = require('../utils');

/**
 * Return the value associated with a given key.
 *
 * @param {String} key Key to use when searching the database.
 * @options {Object} options
 * @callback {Function} callback
 * @param {Error} err Error object.
 * @param {*} result Value associated with the given key.
 * @promise
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
