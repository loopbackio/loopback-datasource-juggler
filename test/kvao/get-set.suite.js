'use strict';

var should = require('should');
var helpers = require('./_helpers');
var Promise = require('bluebird');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  describe('get/set', function() {
    var CacheItem;
    beforeEach(function unpackContext() {
      CacheItem = helpers.givenCacheItem(dataSourceFactory);
    });

    it('works for string values - Callback API', function(done) {
      CacheItem.set('a-key', 'a-value', function(err) {
        if (err) return done(err);
        CacheItem.get('a-key', function(err, value) {
          if (err) return done(err);
          should.equal(value, 'a-value');
          done();
        });
      });
    });

    it('works for string values - Promise API', function() {
      return CacheItem.set('a-key', 'a-value')
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) { should.equal(value, 'a-value'); });
    });

    it('works for Object values', function() {
      return CacheItem.set('a-key', { a: 1, b: 2 })
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) { value.should.eql({ a: 1, b: 2 }); });
    });

    it('works for Buffer values', function() {
      return CacheItem.set('a-key', new Buffer([1, 2, 3]))
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) { value.should.eql(new Buffer([1, 2, 3])); });
    });

    it('works for Date values', function() {
      return CacheItem.set('a-key', new Date('2016-08-03T11:53:03.470Z'))
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) {
          value.should.be.instanceOf(Date);
          value.toISOString().should.equal('2016-08-03T11:53:03.470Z');
        });
    });

    it('works for Number values - integers', function() {
      return CacheItem.set('a-key', 12345)
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) { value.should.equal(12345); });
    });

    it('works for Number values - floats', function() {
      return CacheItem.set('a-key', 12.345)
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) { value.should.equal(12.345); });
    });

    it('works for Boolean values', function() {
      return CacheItem.set('a-key', false)
        .then(function() { return CacheItem.get('a-key'); })
        .then(function(value) { value.should.equal(false); });
    });

    it('honours options.ttl', function() {
      return Promise.resolve(CacheItem.set('a-key', 'a-value', { ttl: 10 }))
      .delay(20)
      .then(function() { return CacheItem.get('a-key'); })
      .then(function(value) { should.equal(value, null); });
    });

    describe('get', function() {
      it('returns "null" when key does not exist', function() {
        return CacheItem.get('key-does-not-exist')
          .then(function(value) { should.equal(value, null); });
      });

      it('converts numeric options arg to options.ttl', function() {
        return Promise.resolve(CacheItem.set('a-key', 'a-value', 10))
          .delay(20)
          .then(function() { return CacheItem.get('a-key'); })
          .then(function(value) { should.equal(value, null); });
      });
    });

    describe('set', function() {
      it('resets TTL timer', function() {
        return Promise.resolve(CacheItem.set('a-key', 'a-value', { ttl: 10 }))
          .then(function() {
            return CacheItem.set('a-key', 'another-value'); // no TTL
          })
          .delay(20)
          .then(function() { return CacheItem.get('a-key'); })
          .then(function(value) { should.equal(value, 'another-value'); });
      });
    });
  });
};
