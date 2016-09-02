'use strict';

var should = require('should');
var helpers = require('./_helpers');
var Promise = require('bluebird');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  describe('expire', function() {
    var CacheItem;
    beforeEach(function unpackContext() {
      CacheItem = helpers.givenCacheItem(dataSourceFactory);
    });

    it('sets key ttl - Callback API', function(done) {
      CacheItem.set('a-key', 'a-value', function(err) {
        if (err) return done(err);
        CacheItem.expire('a-key', 1, function(err) {
          if (err) return done(err);
          setTimeout(function() {
            CacheItem.get('a-key', function(err, value) {
              if (err) return done(err);
              should.equal(value, null);
              done();
            });
          }, 20);
        });
      });
    });

    it('sets key ttl - Promise API', function() {
      return CacheItem.set('a-key', 'a-value')
        .then(function() { return CacheItem.expire('a-key', 1); })
        .delay(20)
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) { should.equal(value, null); });
    });

    it('returns error when expiring a key that has expired', function() {
      return Promise.resolve(CacheItem.set('expired-key', 'a-value', 1))
        .delay(20)
        .then(function() { return CacheItem.expire('expired-key', 1000); })
        .then(
          function() { throw new Error('expire() should have failed'); },
          function(err) {
            err.message.should.match(/expired-key/);
            err.should.have.property('statusCode', 404);
          });
    });

    it('returns error when key does not exist', function() {
      return CacheItem.expire('key-does-not-exist', 1).then(
        function() { throw new Error('expire() should have failed'); },
        function(err) {
          err.message.should.match(/key-does-not-exist/);
          err.should.have.property('statusCode', 404);
        });
    });
  });
};
