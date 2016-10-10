'use strict';

var assert = require('assert');
var Connector = require('loopback-connector').Connector;
var createPacker = require('./packer');
var debug = require('debug')('loopback:connector:kv-extreme-scale');
var extend = require('util')._extend;
var util = require('util');
var request = require('request');

exports.initialize = function initializeDataSource(dataSource, callback) {
  var settings = dataSource.settings;

  dataSource.connector = new ExtremeScaleKVConnector(settings, dataSource);

  if (!callback) return;
  return process.nextTick(callback);
};

exports._Connector = ExtremeScaleKVConnector;

/**
 * @constructor
 *
 * Constructor for the KeyValue ExtremeScale connector.
 *
 * @param {Object} settings
 * @param {DataSource} dataSource The data source instance.
 *
 * @header ExtremeScaleKeyValueConnector(settings, dataSource)
 */
function ExtremeScaleKVConnector(settings, dataSource) {
  Connector.call(this, 'kv-extreme-scale', settings);
  this.dataSource = dataSource;

  debug('Connector settings', settings);

  // set key expiration based on LastUpdateTime with Optimistic locking
  this._url = settings.url + '.LUT.O';

  this._queryUrl = this._url
    .replace(/\/v1\/grids\//, '/v1/query/')
    .replace(/\/$/, '');

  this._strictSSL = settings.strictSSL;
  this._packer = createPacker();
  this.DataAccessObject = dataSource.juggler.KeyValueAccessObject;
};

util.inherits(ExtremeScaleKVConnector, Connector);

/**
 * Persist a value and associate it with the given key.
 *
 * @param {String} modelName The model name to associate with the given key.
 * @param {String} key Key to associate with the given value.
 * @param {*} value Value to persist.
 * @options {Object} options
 * @property {Number} ttl TTL (time to live) for the key-value pair in ms
 *   (milliseconds).
 * @callback {Function} callback
 * @param {Error} err Error object.
 *
 * @header ExtremeScaleKeyValueConnector.prototype.set(modelName, key, value, cb)
 */
ExtremeScaleKVConnector.prototype.set =
function(modelName, key, value, options, callback) {
  var composedKey = ExtremeScaleKVConnector._composeKey(modelName, key);
  debug('POST %j %j (%j)', composedKey, value, options);

  var body = this._packer.encode(value).slice();

  var requestOptions = {
    baseUrl: this._url,
    uri: '/' + encodeURIComponent(composedKey),
    method: 'POST',
    qs: {ttl: options.ttl ? +options.ttl / 1000 : undefined},
    body: body,
    headers: {
      'content-type': 'application/octet-stream',
    },
  };

  this.request(requestOptions, function(err, res, body) {
    callback(err);
  });
};

/*
 * Return the value associated with a given key.
 *
 * @param {String} modelName The model name to associate with the given key.
 * @param {String} key Key to use when searching the database.
 * @options {Object} options
 * @callback {Function} callback
 * @param {Error} err Error object.
 * @param {*} result Value associated with the given key.
 *
 * @header ExtremeScaleKeyValueConnector.prototype.get(modelName, key, cb)
 */
ExtremeScaleKVConnector.prototype.get =
function(modelName, key, options, callback) {
  var packer = this._packer;
  var composedKey = ExtremeScaleKVConnector._composeKey(modelName, key);
  debug('GET %j (%j)', composedKey, options);

  var requestOptions = {
    uri: '/' + encodeURIComponent(composedKey),
    method: 'GET',
    encoding: null, // get the body as a raw Buffer
  };

  this.request(requestOptions, function(err, res, body) {
    if (err && err.statusCode === 404 && /^CWOBJ9752E/.test(err.message))
      return callback(null, null); // key not found

    if (err)
      return callback(err);

    var value = packer.decode(body);
    return callback(null, value);
  });
};

/**
 * Set the TTL (time to live) in ms (milliseconds) for a given key. TTL is the
 * remaining time before a key-value pair is discarded from the database.
 *
 * @param {String} modelName The model name to associate with the given key.
 * @param {String} key Key to use when searching the database.
 * @param {Number} ttl TTL in ms to set for the key.
 * @options {Object} options
 * @callback {Function} callback
 * @param {Error} err Error object.
 *
 * @header ExtremeScaleKeyValueConnector.prototype.expire(modelName, key, ttl, cb)
 */
ExtremeScaleKVConnector.prototype.expire =
function(modelName, key, ttl, options, callback) {
  var err = new Error(
    'ExtremeScale connector does not support "expire" method');
  err.statusCode = 501;
  callback(err);
};

/**
 * Return the TTL (time to live) for a given key. TTL is the remaining time
 * before a key-value pair is discarded from the database.
 *
 * @param {String} modelName The model name to associate with the given key.
 * @param {String} key Key to use when searching the database.
 * @options {Object} options
 * @callback {Function} callback
 * @param {Error} error
 * @param {Number} ttl Expiration time for the key-value pair. `undefined` if
 *   TTL was not initially set.
 *
 * @header ExtremeScaleKeyValueConnector.prototype.ttl(modelName, key, cb)
 */
ExtremeScaleKVConnector.prototype.ttl =
function(modelName, key, options, callback) {
  var err = new Error(
    'ExtremeScale connector does not support "ttl" method');
  err.statusCode = 501;
  callback(err);
};

/**
 * Asynchronously iterate all keys in the database. Similar to `.keys()` but
 * instead allows for iteration over large data sets without having to load
 * everything into memory at once.
 *
 * @param {String} modelName The model name to associate with the given key.
 * @param {Object} filter An optional filter object with the following
 * @param {String} filter.match Glob string to use to filter returned
 *   keys (i.e. `userid.*`).
 * @param {Object} options
 * @returns {AsyncIterator} An Object implementing `next(cb) -> Promise`
 *   function that can be used to iterate all keys.
 *
 * @header ExtremeScaleKeyValueConnector.prototype.iterateKeys(modelName, filter)
 */
ExtremeScaleKVConnector.prototype.iterateKeys =
function(modelName, filter, options) {
  var keyQuery = globToRegexp(filter.match || '*');
  var query = ExtremeScaleKVConnector._composeKey(modelName, keyQuery);

  var self = this;

  var requestOptions = {
    baseUrl: this._queryUrl,
    uri: '/',
    method: 'GET',
    qs: {query: query},
    json: true,
  };

  var cache;

  return {
    next: getNextKey,
  };

  function getNextKey(callback) {
    if (!cache)
      return fetchFirst500Keys(callback);

    if (!cache.length)
      return reportEnd(callback);

    takeNextFromCache(callback);
  }

  function takeNextFromCache(callback) {
    var value = cache.shift();
    var parsed = ExtremeScaleKVConnector._parseKey(value);

    if (parsed.modelName !== modelName) {
      g.warn(
        'Warning: key scan returned a key beloging to a wrong model.' +
          '\nExpected model name: %j' +
          '\nActual model name:   %j' +
          '\nThe key: %j',
        modelName, parsed.modelName, value);
    }

    setImmediate(function() {
      callback(null, parsed.key);
    });
  }

  function reportEnd(callback) {
    setImmediate(function() {
      callback();
    });
  }

  function fetchFirst500Keys(callback) {
    self.request(requestOptions, function(err, res, body) {
      if (err) return callback(err);
      cache = body.items.map(function(it) { return it.key; });
      getNextKey(callback);
    });
  }
};

ExtremeScaleKVConnector.prototype.request = function(options, callback) {
  options = extend({
    baseUrl: this._url,
    strictSSL: this._strictSSL,
  }, options);

  debug('request %j', options);
  request(options, function handleErrorResponse(err, res, body) {
    if (err) {
      debug('err', err);
      return callback(err);
    }

    if (res.statusCode / 100 !== 2) {
      debug('err code=%s body=%j',
        res.statusCode,
        (body instanceof Buffer ? body.toString() : body));
      return callback(createErrorFromResponse(res, body));
    }

    debug('success (%s), body=%s', res.statusCode, body);
    callback(err, res, body);
  });
};

// TODO(bajtos) move this code to loopback-connector
ExtremeScaleKVConnector._composeKey = function(modelName, key) {
  // Escape the first value to prevent collision
  //  'model' + 'foo:bar' --vs-- 'model:foo' + 'bar'
  return encodeURIComponent(modelName) + ':' + key;
};

var PARSE_KEY_REGEX = /^([^:]*):(.*)/;
ExtremeScaleKVConnector._parseKey = function(encoded) {
  var m = encoded.match(PARSE_KEY_REGEX);
  if (m) {
    return {
      modelName: m[1],
      key: m[2],
    };
  }

  debug('Invalid key - missing model-name prefix: %s', encoded);
  return {
    modelName: null,
    key: encoded,
  };
};

function createErrorFromResponse(res, body) {
  debug('%s %s %j', res.statusCode, res.statusMessage, body);
  if (body instanceof Buffer) {
    body = body.toString();
  }

  // We cannot rely on Content-Type response header as the server
  // returns "application/atom+xml" (??)
  var looksLikeJsonStrig = typeof body === 'string' &&
    body[0] === '{' &&
    body[body.length - 1] === '}';
  if (looksLikeJsonStrig) {
    try {
      body = JSON.parse(body);
    } catch (err) {
      debug('Cannot parse JSON response %j', body);
    }
  }

  var msg = body && body.error || body ||
    res.statusCode + ' ' + res.statusMessage;
  var err = new Error(msg);
  err.statusCode = res.statusCode;
  return err;
}

function globToRegexp(value) {
  return value
    // escape regexp
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    // convert \* to .*
    .replace(/\\\*/g, '.*')
    // convert \? to .
    .replace(/\\\?/g, '.');
}
