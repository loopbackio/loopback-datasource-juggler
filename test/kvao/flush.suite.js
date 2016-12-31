'use strict';

const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const should = require('should');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  var supportsFlushOperation =
    connectorCapabilities.supportsFlushOperation !== false;

  bdd.describeIf(supportsFlushOperation, 'flush', function() {
    let CacheItem;
    beforeEach(function unpackContext() {
      CacheItem = helpers.givenCacheItem(dataSourceFactory);
      return CacheItem.flush();
    });

    it('removes all associated keys for a given model', function() {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(() => CacheItem.flush())
        .then(() => CacheItem.keys())
        .done((keys) => {
          should(keys).eql([]);
        });
    });
  });
};
