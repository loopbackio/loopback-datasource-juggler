// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/* eslint-disable camelcase */

var assert = require('assert');
var should = require('should');

var includeUtils = require('../lib/include_utils');

describe('include_util', function() {
  describe('#buildOneToOneIdentityMapWithOrigKeys', function() {
    it('should return an object with keys', function() {
      var objs = [
          { id: 11, letter: 'A' },
          { id: 22, letter: 'B' },
      ];
      var result = includeUtils.buildOneToOneIdentityMapWithOrigKeys(objs, 'id');
      result.get(11).should.be.ok;
      result.get(22).should.be.ok;
    });

    it('should overwrite keys in case of collision', function() {
      var objs = [
            { id: 11, letter: 'A' },
            { id: 22, letter: 'B' },
            { id: 33, letter: 'C' },
            { id: 11, letter: 'HA!' },
      ];

      var result = includeUtils.buildOneToOneIdentityMapWithOrigKeys(objs, 'id');
      result.getKeys().should.containEql(11);
      result.getKeys().should.containEql(22);
      result.getKeys().should.containEql(33);
      result.get(11)['letter'].should.equal('HA!');
      result.get(33)['letter'].should.equal('C');
    });
  });
  describe('#buildOneToOneIdentityMapWithOrigKeys', function() {
    it('should return an object with keys', function() {
      var objs = [
        { id: 11, letter: 'A' },
        { id: 22, letter: 'B' },
      ];
      var result = includeUtils.buildOneToOneIdentityMapWithOrigKeys(objs, 'id');
      result.get(11).should.be.ok;
      result.get(22).should.be.ok;
      result.getKeys().should.have.lengthOf(2);  // no additional properties
    });
  });
  describe('#buildOneToManyIdentityMap', function() {
    it('should return an object with keys', function() {
      var objs = [
                { id: 11, letter: 'A' },
                { id: 22, letter: 'B' },
      ];
      var result = includeUtils.buildOneToManyIdentityMapWithOrigKeys(objs, 'id');
      result.exist(11).should.be.true;
      result.exist(22).should.be.true;
    });

    it('should collect keys in case of collision', function() {
      var objs = [
                { fk_id: 11, letter: 'A' },
                { fk_id: 22, letter: 'B' },
                { fk_id: 33, letter: 'C' },
                { fk_id: 11, letter: 'HA!' },
      ];

      var result = includeUtils.buildOneToManyIdentityMapWithOrigKeys(objs, 'fk_id');
      result.get(11)[0]['letter'].should.equal('A');
      result.get(11)[1]['letter'].should.equal('HA!');
      result.get(33)[0]['letter'].should.equal('C');
    });
  });
});

describe('KVMap', function() {
  it('should allow to set and get value with key string', function() {
    var map = new includeUtils.KVMap();
    map.set('name', 'Alex');
    map.set('gender', true);
    map.set('age', 25);
    map.get('name').should.be.equal('Alex');
    map.get('gender').should.be.equal(true);
    map.get('age').should.be.equal(25);
  });
  it('should allow to set and get value with arbitrary key type', function() {
    var map = new includeUtils.KVMap();
    map.set('name', 'Alex');
    map.set(true, 'male');
    map.set(false, false);
    map.set({ isTrue: 'yes' }, 25);
    map.get('name').should.be.equal('Alex');
    map.get(true).should.be.equal('male');
    map.get(false).should.be.equal(false);
    map.get({ isTrue: 'yes' }).should.be.equal(25);
  });
  it('should not allow to get values with [] operator', function() {
    var map = new includeUtils.KVMap();
    map.set('name', 'Alex');
    (map['name'] === undefined).should.be.equal(true);
  });
  it('should provide .exist() method for checking if key presented', function() {
    var map = new includeUtils.KVMap();
    map.set('one', 1);
    map.set(2, 'two');
    map.set(true, 'true');
    map.exist('one').should.be.true;
    map.exist(2).should.be.true;
    map.exist(true).should.be.true;
    map.exist('two').should.be.false;
  });
  it('should return array of original keys with .getKeys()', function() {
    var map = new includeUtils.KVMap();
    map.set('one', 1);
    map.set(2, 'two');
    map.set(true, 'true');
    var keys = map.getKeys();
    keys.should.containEql('one');
    keys.should.containEql(2);
    keys.should.containEql(true);
  });
  it('should allow to store and fetch arrays', function() {
    var map = new includeUtils.KVMap();
    map.set(1, [1, 2, 3]);
    map.set(2, [2, 3, 4]);
    var valueOne = map.get(1);
    valueOne.should.be.eql([1, 2, 3]);
    valueOne.push(99);
    map.set(1, valueOne);
    var valueOneUpdated = map.get(1);
    valueOneUpdated.should.be.eql([1, 2, 3, 99]);
  });
});
