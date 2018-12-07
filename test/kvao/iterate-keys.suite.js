'use strict';

const asyncIterators = require('async-iterators');
const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const Promise = require('bluebird');
const should = require('should');
const toArray = Promise.promisify(asyncIterators.toArray);

module.exports = function(dataSourceFactory, connectorCapabilities) {
  const canIterateKeys = connectorCapabilities.canIterateKeys !== false;

  bdd.describeIf(canIterateKeys, 'iterateKeys', function() {
    let CacheItem;
    beforeEach(setupCacheItem);

    it('returns AsyncIterator covering all keys', function() {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(function() {
          const it = CacheItem.iterateKeys();
          should(it).have.property('next');
          return toArray(it);
        })
        .then(function(keys) {
          keys.sort();
          should(keys).eql(['key1', 'key2']);
        });
    });

    it('returns AsyncIterator supporting Promises', function() {
      let iterator;
      return helpers.givenKeys(CacheItem, ['key'])
        .then(function() {
          iterator = CacheItem.iterateKeys();
          return iterator.next();
        })
        .then(function(key) {
          should(key).equal('key');
          return iterator.next();
        })
        .then(function(key) {
          // Note: AsyncIterator contract requires `undefined` to signal
          // the end of the sequence. Other false-y values like `null`
          // don't work.
          should(key).equal(undefined);
        });
    });

    function setupCacheItem() {
      return helpers.givenCacheItem(dataSourceFactory)
        .then(ModelCtor => CacheItem = ModelCtor);
    }
  });
};
