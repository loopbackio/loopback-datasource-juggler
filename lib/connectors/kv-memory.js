// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const g = require('strong-globalize')();

const assert = require('assert');
const Connector = require('loopback-connector').Connector;
const debug = require('debug')('loopback:connector:kv-memory');
const minimatch = require('minimatch');
const util = require('util');

exports.initialize = function initializeDataSource(dataSource, cb) {
  const settings = dataSource.settings;
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
}
util.inherits(KeyValueMemoryConnector, Connector);

KeyValueMemoryConnector.prototype._setupRegularCleanup = function() {
  // Scan the database for expired keys at a regular interval
  // in order to release memory. Note that GET operation checks
  // key expiration too, the scheduled cleanup is merely a performance
  // optimization.
  this._cleanupTimer = setInterval(
    () => {
      if (this && this._removeExpiredItems) {
        this._removeExpiredItems();
      } else {
        // The datasource/connector was destroyed - cancel the timer
        clearInterval(this._cleanupTimer);
      }
    },
    1000,
  );
  this._cleanupTimer.unref();
};

KeyValueMemoryConnector._removeExpiredItems = function() {
  debug('Running scheduled cleanup of expired items.');
  for (const modelName in this._store) {
    const modelStore = this._store[modelName];
    for (const key in modelStore) {
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

KeyValueMemoryConnector.prototype._removeIfExpired = function(modelName, key) {
  const store = this._getStoreForModel(modelName);
  let item = store[key];
  if (item && item.isExpired()) {
    debug('Removing expired key', key);
    delete store[key];
    item = undefined;
    return true;
  }
  return false;
};

KeyValueMemoryConnector.prototype.get =
function(modelName, key, options, callback) {
  this._removeIfExpired(modelName, key);

  const store = this._getStoreForModel(modelName);
  const item = store[key];
  let value = item ? item.value : null;
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
  const store = this._getStoreForModel(modelName);
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
  this._removeIfExpired(modelName, key);

  const store = this._getStoreForModel(modelName);

  if (!(key in store)) {
    return process.nextTick(function() {
      const err = new Error(g.f('Cannot expire unknown key %j', key));
      err.statusCode = 404;
      callback(err);
    });
  }

  debug('EXPIRE %j %j %s', modelName, key, ttl || '(never)');
  store[key].setTtl(ttl);
  process.nextTick(callback);
};

KeyValueMemoryConnector.prototype.ttl =
function(modelName, key, options, callback) {
  this._removeIfExpired(modelName, key);

  const store = this._getStoreForModel(modelName);

  // key is unknown
  if (!(key in store)) {
    return process.nextTick(function() {
      const err = new Error(g.f('Cannot get TTL for unknown key %j', key));
      err.statusCode = 404;
      callback(err);
    });
  }

  const ttl = store[key].getTtl();
  debug('TTL %j %j -> %s', modelName, key, ttl);

  process.nextTick(function() {
    callback(null, ttl);
  });
};

KeyValueMemoryConnector.prototype.iterateKeys =
function(modelName, filter, options, callback) {
  const store = this._getStoreForModel(modelName);
  const self = this;
  const checkFilter = createMatcher(filter.match);

  const keys = Object.keys(store).filter(function(key) {
    return !self._removeIfExpired(modelName, key) && checkFilter(key);
  });

  debug('ITERATE KEYS %j -> %s keys', modelName, keys.length);

  let ix = 0;
  return {
    next: function(cb) {
      const value = ix < keys.length ? keys[ix++] : undefined;
      setImmediate(function() { cb(null, value); });
    },
  };
};

function createMatcher(pattern) {
  if (!pattern) return function matchAll() { return true; };

  return minimatch.filter(pattern, {
    nobrace: true,
    noglobstar: true,
    dot: true,
    noext: true,
    nocomment: true,
  });
}

KeyValueMemoryConnector.prototype.disconnect = function(callback) {
  if (this._cleanupTimer)
    clearInterval(this._cleanupTimer);
  this._cleanupTimer = null;
  process.nextTick(callback);
};

KeyValueMemoryConnector.prototype.delete =
function(modelName, key, options, callback) {
  const store = this._getStoreForModel(modelName);
  delete store[key];
  callback();
};

KeyValueMemoryConnector.prototype.deleteAll =
function(modelName, options, callback) {
  const modelStore = this._getStoreForModel(modelName);
  for (const key in modelStore)
    delete modelStore[key];
  callback();
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

StoreItem.prototype.getTtl = function() {
  return !this.expires ? undefined : this.expires - Date.now();
};
