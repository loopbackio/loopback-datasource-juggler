// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const bdd = require('../helpers/bdd-if');
const should = require('should');
const helpers = require('./_helpers');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  // While we support millisecond precision, for the purpose of tests
  // it's better to use intervals at least 10ms long.
  const ttlPrecision = connectorCapabilities.ttlPrecision || 10;

  const canExpire = connectorCapabilities.canExpire !== false;

  bdd.describeIf(canExpire, 'expire', function() {
    let CacheItem;
    beforeEach(setupCacheItem);

    it('sets key ttl - Callback API', function(done) {
      CacheItem.set('a-key', 'a-value', function(err) {
        if (err) return done(err);
        CacheItem.expire('a-key', ttlPrecision, function(err) {
          if (err) return done(err);
          setTimeout(function() {
            CacheItem.get('a-key', function(err, value) {
              if (err) return done(err);
              should.equal(value, null);
              done();
            });
          }, 2 * ttlPrecision);
        });
      });
    });

    it('sets key ttl - Promise API', function() {
      return CacheItem.set('a-key', 'a-value')
        .then(function() { return CacheItem.expire('a-key', ttlPrecision); })
        .then(() => helpers.delay(2 * ttlPrecision))
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) { should.equal(value, null); });
    });

    it('returns error when expiring a key that has expired', function() {
      return Promise.resolve(CacheItem.set('expired-key', 'a-value', ttlPrecision))
        .then(() => helpers.delay(2 * ttlPrecision))
        .then(function() { return CacheItem.expire('expired-key', 1000); })
        .then(
          function() { throw new Error('expire() should have failed'); },
          function(err) {
            err.message.should.match(/expired-key/);
            err.should.have.property('statusCode', 404);
          },
        );
    });

    it('returns error when key does not exist', function() {
      return CacheItem.expire('key-does-not-exist', ttlPrecision).then(
        function() { throw new Error('expire() should have failed'); },
        function(err) {
          err.message.should.match(/key-does-not-exist/);
          err.should.have.property('statusCode', 404);
        },
      );
    });

    function setupCacheItem() {
      return helpers.givenCacheItem(dataSourceFactory)
        .then(ModelCtor => CacheItem = ModelCtor);
    }
  });
};
