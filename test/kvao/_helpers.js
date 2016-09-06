'use strict';

var Promise = require('bluebird');

exports.givenCacheItem = function(dataSourceFactory) {
  var dataSource = dataSourceFactory();
  return dataSource.createModel('CacheItem', {
    key: String,
    value: 'any',
  });
};

exports.givenKeys = function(Model, keys, cb) {
  var p = Promise.all(
    keys.map(function(k) {
      return Model.set(k, 'value-' + k);
    })
  );
  if (cb) {
    p = p.then(function(r) { cb(null, r); }, cb);
  }
  return p;
};
