'use strict';

const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const should = require('should');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  var supportsDeleteAllOperation =
    connectorCapabilities.supportsDeleteAllOperation !== false;

  bdd.describeIf(supportsDeleteAllOperation, 'deleteAll', function() {
    let CacheItem;
    beforeEach(function unpackContext() {
      CacheItem = helpers.givenCacheItem(dataSourceFactory);
    });

    it('removes all keys-value pairs associated to the given model', function() {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(() => CacheItem.deleteAll())
        .then(() => CacheItem.keys())
        .then((keys) => {
          should(keys).eql([]);
        });
    });

    it('does not remove keys-value pairs unassociated to the given model',
    function() {
      var NonCacheItem = dataSourceFactory().createModel('NonCacheItem', {
        key: String,
        value: 'any',
      });
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(() => helpers.givenKeys(NonCacheItem, ['key3', 'key4']))
        .then(() => CacheItem.deleteAll())
        .then(() => CacheItem.keys())
        .then((keys) => {
          should(keys).eql([]);
        })
        .then(() => NonCacheItem.keys())
        .then((keys) => {
          should(keys).eql(['key3', 'key4']);
        });
    });
  });
};
