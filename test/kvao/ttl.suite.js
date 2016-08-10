'use strict';

var should = require('should');
var helpers = require('./_helpers');
var Promise = require('bluebird');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  describe('ttl', function() {
    var CacheItem;
    beforeEach(function unpackContext() {
      CacheItem = helpers.givenCacheItem(dataSourceFactory);
    });

    it('returns an error when key does not exist', function() {
      return CacheItem.ttl('key-does-not-exist').then(
        function() { throw new Error('ttl() should have failed'); },
        function(err) {
          err.message.should.match(/key-does-not-exist/);
          err.should.have.property('statusCode', 404);
        });
    });

    it('returns `undefined` when key does not expire', function() {
      return CacheItem.set('a-key', 'a-value')
        .then(function() { return CacheItem.ttl('a-key'); })
        .then(function(ttl) { should.not.exist(ttl); });
    });

    context('existing key with expire before expiration time', function() {
      it('returns ttl - Callback API', function(done) {
        CacheItem.set('a-key', 'a-value', 10, function(err) {
          if (err) return done(err);
          CacheItem.ttl('a-key', function(err, ttl) {
            if (err) return done(err);
            ttl.should.be.within(0, 10);
            done();
          });
        });
      });

      it('returns ttl - Promise API', function() {
        return Promise.resolve(
            CacheItem.set('a-key', 'a-value', 10)
          )
          .delay(1)
          .then(function() { return CacheItem.ttl('a-key'); })
          .then(function(ttl) { ttl.should.be.within(0, 10); });
      });
    });

    context('existing key with expire after expiration time', function(done) {
      it('returns an error', function() {
        return Promise.resolve(
            CacheItem.set('key-does-not-exist', 'a-value', 10)
          )
          .delay(20)
          .then(function() {
            return CacheItem.ttl('key-does-not-exist');
          })
          .then(
            function() { throw new Error('ttl() should have failed'); },
            function(err) {
              err.message.should.match(/key-does-not-exist/);
              err.should.have.property('statusCode', 404);
            });
      });
    });
  });
};
