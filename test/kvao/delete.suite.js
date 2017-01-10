'use strict';

const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const should = require('should');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  var supportsDelete = 'delete' in dataSourceFactory().connector;

  bdd.describeIf(supportsDelete, 'delete', function() {
    let CacheItem;
    beforeEach(function unpackContext() {
      CacheItem = helpers.givenCacheItem(dataSourceFactory);
      return CacheItem.deleteAll();
    });

    it('removes the key-value pair for the given key', function() {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(() => CacheItem.delete('key1'))
        .then(() => CacheItem.keys())
        .then((keys) => {
          keys.should.eql(['key2']);
        });
    });
  });
};
