'use strict';

var assert = require('assert');
var async = require('async');
var debug = require('debug')('loopback:kvao:delete-all');
var utils = require('../utils');

/**
 * Delete all keys (and values) associated to the current model.
 *
 * @options {Object} options Unused ATM, placeholder for future options.
 * @callback {Function} callback
 * @param {Error} err Error object.
 * @promise
 *
 * @header KVAO.prototype.deleteAll([options, ]cb)
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

  var connector = this.getConnector();
  if (typeof connector.deleteAll === 'function') {
    connector.deleteAll(this.modelName, options, callback);
  } else if (typeof connector.delete === 'function') {
    debug('Falling back to unoptimized key-value pair deletion');
    iterateAndDelete(connector, this.modelName, options, callback);
  } else {
    var errMsg = 'Connector does not support key-value pair deletion';
    debug(errMsg);
    process.nextTick(function() {
      var err = new Error(errMsg);
      err.statusCode = 501;
      callback(err);
    });
  }
  return callback.promise;
};

function iterateAndDelete(connector, modelName, options, callback) {
  var iter = connector.iterateKeys(modelName, {});
  var keys = [];
  iter.next(onNextKey);

  function onNextKey(err, key) {
    if (err) return callback(err);
    if (key === undefined) return callback();
    connector.delete(modelName, key, options, onDeleted);
  }

  function onDeleted(err) {
    if (err) return callback(err);
    iter.next(onNextKey);
  }
}
