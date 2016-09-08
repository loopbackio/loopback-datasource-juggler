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

    it('gets TTL when key with unexpired TTL exists - Promise API',
    function() {
      return Promise.resolve(
          CacheItem.set('a-key', 'a-value', {ttl: 1000}))
        .delay(1)
        .then(function() { return CacheItem.ttl('a-key'); })
        .then(function(ttl) { ttl.should.be.within(1, 1000); });
    });

    it('gets TTL when key with unexpired TTL exists - Callback API',
    function(done) {
      CacheItem.set('a-key', 'a-value', {ttl: 1000}, function(err) {
        if (err) return done(err);
        CacheItem.ttl('a-key', function(err, ttl) {
          if (err) return done(err);
          ttl.should.be.within(1, 1000);
          done();
        });
      });
    });

    it('succeeds when key without TTL exists', function() {
      return CacheItem.set('a-key', 'a-value')
        .then(function() { return CacheItem.ttl('a-key'); })
        .then(function(ttl) { should.not.exist(ttl); });
    });

    it('fails when getting TTL for a key with expired TTL', function() {
      return Promise.resolve(
          CacheItem.set('expired-key', 'a-value', {ttl: 10})).delay(20)
        .then(function() {
          return CacheItem.ttl('expired-key');
        })
        .then(
          function() { throw new Error('ttl() should have failed'); },
          function(err) {
            err.message.should.match(/expired-key/);
            err.should.have.property('statusCode', 404);
          });
    });

    it('fails when key does not exist', function() {
      return CacheItem.ttl('key-does-not-exist').then(
        function() { throw new Error('ttl() should have failed'); },
        function(err) {
          err.message.should.match(/key-does-not-exist/);
          err.should.have.property('statusCode', 404);
        });
    });
  });
};
