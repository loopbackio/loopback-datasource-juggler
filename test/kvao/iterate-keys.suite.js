'use strict';

var asyncIterators = require('async-iterators');
var bdd = require('../helpers/bdd-if');
var helpers = require('./_helpers');
var Promise = require('bluebird');
var should = require('should');
var toArray = Promise.promisify(asyncIterators.toArray);

module.exports = function(dataSourceFactory, connectorCapabilities) {
  var canIterateKeys = connectorCapabilities.canIterateKeys !== false;

  bdd.describeIf(canIterateKeys, 'iterateKeys', function() {
    var CacheItem;
    beforeEach(setupCacheItem);

    it('returns AsyncIterator covering all keys', function() {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(function() {
          var it = CacheItem.iterateKeys();
          should(it).have.property('next');
          return toArray(it);
        })
        .then(function(keys) {
          keys.sort();
          should(keys).eql(['key1', 'key2']);
        });
    });

    it('returns AsyncIterator supporting Promises', function() {
      var iterator;
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
    };
  });
};
