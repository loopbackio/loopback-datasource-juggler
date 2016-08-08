'use strict';

exports.givenCacheItem = function(dataSourceFactory) {
  var dataSource = dataSourceFactory();
  return dataSource.createModel('CacheItem', {
    key: String,
    value: 'any',
  });
};
