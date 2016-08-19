'use strict';

var helpers = require('./_helpers');
var Promise = require('bluebird');
var should = require('should');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  describe('keys', function() {
    var CacheItem;
    beforeEach(function unpackContext() {
      CacheItem = helpers.givenCacheItem(dataSourceFactory);
      CacheItem.sortedKeys = function(filter, options) {
        return this.keys(filter, options).then(function(keys) {
          keys.sort();
          return keys;
        });
      };
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
      var AnotherModel = CacheItem.dataSource.createModel('AnotherModel');
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(function() {
          return helpers.givenKeys(AnotherModel, ['otherKey1', 'otherKey2']);
        })
        .then(function() {
          return CacheItem.sortedKeys();
        })
        .then(function(keys) {
          should(keys).eql(['key1', 'key2']);
        });
    });

    it('handles large key set', function() {
      var expectedKeys = [];
      for (var ix = 0; ix < 1000; ix++)
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
