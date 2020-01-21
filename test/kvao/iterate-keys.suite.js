// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const asyncIterators = require('async-iterators');
const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const should = require('should');

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

// A promisified version of asyncIterators.toArray
// Node.js 8.x does not have util.promisify function,
// we are adding promise support manually here
function toArray(iter) {
  return new Promise((resolve, reject) => {
    asyncIterators.toArray(iter, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
