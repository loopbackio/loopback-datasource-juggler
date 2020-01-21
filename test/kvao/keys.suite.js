// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const should = require('should');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  const canIterateKeys = connectorCapabilities.canIterateKeys !== false;

  bdd.describeIf(canIterateKeys, 'keys', function() {
    let CacheItem;
    beforeEach(function setupCacheItem() {
      return helpers.givenCacheItem(dataSourceFactory)
        .then(ModelCtor => CacheItem = ModelCtor)
        .then(() => {
          CacheItem.sortedKeys = function(filter, options) {
            return this.keys(filter, options).then(keys => keys.sort());
          };
        });
    });

    it('returns all keys - Callback API', function(done) {
      helpers.givenKeys(CacheItem, ['key1', 'key2'], function(err) {
        if (err) return done(err);
        CacheItem.keys(function(err, keys) {
          if (err) return done(err);
          keys.sort();
          should(keys).eql(['key1', 'key2']);
          done();
        });
      });
    });

    it('returns all keys - Promise API', function() {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(function() {
          return CacheItem.keys();
        })
        .then(function(keys) {
          keys.sort();
          should(keys).eql(['key1', 'key2']);
        });
    });

    it('returns keys of the given model only', function() {
      let AnotherModel;
      return helpers.givenModel(dataSourceFactory, 'AnotherModel')
        .then(ModelCtor => AnotherModel = ModelCtor)
        .then(() => helpers.givenKeys(CacheItem, ['key1', 'key2']))
        .then(() => helpers.givenKeys(AnotherModel, ['otherKey1', 'otherKey2']))
        .then(() => CacheItem.sortedKeys())
        .then(keys => should(keys).eql(['key1', 'key2']));
    });

    const largeKeySets = connectorCapabilities.canIterateLargeKeySets !== false;
    bdd.itIf(largeKeySets, 'handles large key set', function() {
      const expectedKeys = [];
      for (let ix = 0; ix < 1000; ix++)
        expectedKeys.push('key-' + ix);
      expectedKeys.sort();

      return helpers.givenKeys(CacheItem, expectedKeys)
        .then(function() {
          return CacheItem.sortedKeys();
        })
        .then(function(keys) {
          should(keys).eql(expectedKeys);
        });
    });

    context('with "filter.match"', function() {
      beforeEach(function createTestData() {
        return helpers.givenKeys(CacheItem, [
          'hallo',
          'hello',
          'hxllo',
          'hllo',
          'heeello',
          'foo',
          'bar',
        ]);
      });

      it('supports "?" operator', function() {
        return CacheItem.sortedKeys({match: 'h?llo'}).then(function(keys) {
          should(keys).eql(['hallo', 'hello', 'hxllo']);
        });
      });

      it('supports "*" operator', function() {
        return CacheItem.sortedKeys({match: 'h*llo'}).then(function(keys) {
          should(keys).eql(['hallo', 'heeello', 'hello', 'hllo', 'hxllo']);
        });
      });

      it('handles no matches found', function() {
        return CacheItem.sortedKeys({match: 'not-found'})
          .then(function(keys) {
            should(keys).eql([]);
          });
      });
    });
  });
};
