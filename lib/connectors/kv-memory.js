'use strict';

var assert = require('assert');
var Connector = require('loopback-connector').Connector;
var debug = require('debug')('loopback:connector:kv-memory');
var util = require('util');

exports.initialize = function initializeDataSource(dataSource, cb) {
  var settings = dataSource.settings;
  dataSource.connector = new KeyValueMemoryConnector(settings, dataSource);
  if (cb) process.nextTick(cb);
};

function KeyValueMemoryConnector(settings, dataSource) {
  Connector.call(this, 'kv-memory', settings);

  debug('Connector settings', settings);

  this.dataSource = dataSource;
  this.DataAccessObject = dataSource.juggler.KeyValueAccessObject;

  this._store = Object.create(null);

  this._setupRegularCleanup();
};
util.inherits(KeyValueMemoryConnector, Connector);

KeyValueMemoryConnector.prototype._setupRegularCleanup = function() {
  // Scan the database for expired keys at a regular interval
  // in order to release memory. Note that GET operation checks
  // key expiration too, the scheduled cleanup is merely a performance
  // optimization.
  var self = this;
  this._cleanupTimer = setInterval(
    function() { self._removeExpiredItems(); },
    1000);
  this._cleanupTimer.unref();
};

KeyValueMemoryConnector._removeExpiredItems = function() {
  debug('Running scheduled cleanup of expired items.');
  for (var modelName in this._store) {
    var modelStore = this._store[modelName];
    for (var key in modelStore) {
      if (modelStore[key].isExpired()) {
        debug('Removing expired key', key);
        delete modelStore[key];
      }
    }
  }
};

KeyValueMemoryConnector.prototype._getStoreForModel = function(modelName) {
  if (!(modelName in this._store)) {
    this._store[modelName] = Object.create(null);
  }
  return this._store[modelName];
};

KeyValueMemoryConnector.prototype.get =
function(modelName, key, options, callback) {
  var store = this._getStoreForModel(modelName);
  var item = store[key];

  if (item && item.isExpired()) {
    debug('Removing expired key', key);
    delete store[key];
    item = undefined;
  }

  var value = item ? item.value : null;

  debug('GET %j %j -> %s', modelName, key, value);

  if (/^buffer:/.test(value)) {
    value = new Buffer(value.slice(7), 'base64');
  } else if (/^date:/.test(value)) {
    value = new Date(value.slice(5));
  } else if (value != null) {
    value = JSON.parse(value);
  }

  process.nextTick(function() {
    callback(null, value);
  });
};

KeyValueMemoryConnector.prototype.set =
function(modelName, key, value, options, callback) {
  var store = this._getStoreForModel(modelName);
  var value;
  if (Buffer.isBuffer(value)) {
    value = 'buffer:' + value.toString('base64');
  } else if (value instanceof Date) {
    value = 'date:' + value.toISOString();
  } else {
    value = JSON.stringify(value);
  }

  debug('SET %j %j %s %j', modelName, key, value, options);
  store[key] = new StoreItem(value, options && options.ttl);

  process.nextTick(callback);
};

KeyValueMemoryConnector.prototype.expire =
function(modelName, key, ttl, options, callback) {
  var store = this._getStoreForModel(modelName);

  if (!(key in store)) {
    return process.nextTick(function() {
      callback(new Error('Cannot expire unknown key ' + key));
    });
  }

  debug('EXPIRE %j %j %s', modelName, key, ttl || '(never)');
  store[key].setTtl(ttl);
  process.nextTick(callback);
};

KeyValueMemoryConnector.prototype.disconnect = function(callback) {
  if (this._cleanupTimer)
    clearInterval(this._cleanupTimer);
  this._cleanupTimer = null;
  process.nextTick(callback);
};

function StoreItem(value, ttl) {
  this.value = value;
  this.setTtl(ttl);
}

StoreItem.prototype.isExpired = function() {
  return this.expires && this.expires <= Date.now();
};

StoreItem.prototype.setTtl = function(ttl) {
  if (ttl) {
    this.expires = Date.now() + ttl;
  } else {
    this.expires = undefined;
  }
};
