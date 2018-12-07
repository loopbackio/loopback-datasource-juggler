'use strict';

const Promise = require('bluebird');

exports.givenCacheItem = givenCacheItem;
exports.givenKeys = givenKeys;
exports.givenModel = givenModel;

function givenCacheItem(dataSourceFactory) {
  const modelProperties = {
    key: String,
    value: 'Any',
  };
  return givenModel(dataSourceFactory, 'CacheItem', modelProperties);
}

function givenModel(dataSourceFactory, modelName,
  modelProperties, options) {
  const dataSource = dataSourceFactory();
  const Model = dataSource.createModel(modelName, modelProperties);
  const p = 'deleteAll' in dataSource.connector ?
    Model.deleteAll() : Promise.resolve();
  return p.then(() => Model);
}

function givenKeys(Model, keys, cb) {
  let p = Promise.all(
    keys.map(function(k) {
      return Model.set(k, 'value-' + k);
    })
  );
  if (cb) {
    p = p.then(function(r) { cb(null, r); }, cb);
  }
  return p;
}
