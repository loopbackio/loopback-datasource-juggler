'use strict';

const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const should = require('should');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  describe('delete', function() {
    let CacheItem;
    beforeEach(function unpackContext() {
      CacheItem = helpers.givenCacheItem(dataSourceFactory);
      return CacheItem.deleteAll();
    });

    it('removes the keys-value pair associated to the given key',
    function() {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(() => CacheItem.delete('key1'))
        .then(() => CacheItem.keys())
        .then((keys) => {
          should(keys).eql(['key2']);
        });
    });

    it('does not remove key-value pairs unassociated to the given key',
    function() {
      var NonCacheItem = dataSourceFactory().createModel('NonCacheItem', {
        key: String,
        value: 'any',
      });
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(() => helpers.givenKeys(NonCacheItem, ['key3', 'key4']))
        .then(() => CacheItem.delete('key1'))
        .then(() => CacheItem.keys())
        .then((keys) => {
          should(keys).eql(['key2']);
        })
        .then(() => NonCacheItem.keys())
        .then((keys) => {
          should(keys).eql(['key3', 'key4']);
        });
    });
  });
};
