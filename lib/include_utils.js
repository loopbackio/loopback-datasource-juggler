// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const g = require('strong-globalize')();

module.exports.buildOneToOneIdentityMapWithOrigKeys = buildOneToOneIdentityMapWithOrigKeys;
module.exports.buildOneToManyIdentityMapWithOrigKeys = buildOneToManyIdentityMapWithOrigKeys;
module.exports.join = join;
module.exports.KVMap = KVMap;

const util = require('util');

function getId(obj, idName) {
  const id = obj && obj[idName];
  if (id == null) {
    const msg = g.f('ID property "%s" is missing for included item: %j. ' +
      'Please make sure `fields` include "%s" if it\'s present in the `filter`',
    idName, obj, idName);
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
  return id;
}
/**
 * Effectively builds associative map on id -> object relation and stores original keys.
 * Map returned in form of object with ids in keys and object as values.
 * @param objs array of objects to build from
 * @param idName name of property to be used as id. Such property considered to be unique across array.
 * In case of collisions last wins. For non-unique ids use buildOneToManyIdentityMap()
 * @returns {} object where keys are ids and values are objects itself
 */
function buildOneToOneIdentityMapWithOrigKeys(objs, idName) {
  const kvMap = new KVMap();
  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i];
    const id = getId(obj, idName);
    kvMap.set(id, obj);
  }
  return kvMap;
}

function buildOneToManyIdentityMapWithOrigKeys(objs, idName) {
  const kvMap = new KVMap();
  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i];
    const id = getId(obj, idName);
    const value = kvMap.get(id) || [];
    value.push(obj);
    kvMap.set(id, value);
  }
  return kvMap;
}

/**
 * Yeah, it joins. You need three things id -> obj1 map, id -> [obj2] map and merge function.
 * This functions will take each obj1, locate all data to join in map2 and call merge function.
 * @param oneToOneIdMap
 * @param oneToManyIdMap
 * @param mergeF  function(obj, objectsToMergeIn)
 */
function join(oneToOneIdMap, oneToManyIdMap, mergeF) {
  const ids = oneToOneIdMap.getKeys();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const obj = oneToOneIdMap.get(id);
    const objectsToMergeIn = oneToManyIdMap.get(id) || [];
    mergeF(obj, objectsToMergeIn);
  }
}

/**
 * Map with arbitrary keys and values. User .set() and .get() to work with values instead of []
 * @returns {{set: Function, get: Function, remove: Function, exist: Function, getKeys: Function}}
 * @constructor
 */
function KVMap() {
  const _originalKeyFieldName = 'originalKey';
  const _valueKeyFieldName = 'value';
  const _dict = {};
  const keyToString = function(key) { return key.toString(); };
  const mapImpl = {
    set: function(key, value) {
      const recordObj = {};
      recordObj[_originalKeyFieldName] = key;
      recordObj[_valueKeyFieldName] = value;
      _dict[keyToString(key)] = recordObj;
      return true;
    },
    get: function(key) {
      const storeObj = _dict[keyToString(key)];
      if (storeObj) {
        return storeObj[_valueKeyFieldName];
      } else {
        return undefined;
      }
    },
    remove: function(key) {
      delete _dict[keyToString(key)];
      return true;
    },
    exist: function(key) {
      const result = _dict.hasOwnProperty(keyToString(key));
      return result;
    },
    getKeys: function() {
      const result = [];
      for (const key in _dict) {
        result.push(_dict[key][_originalKeyFieldName]);
      }
      return result;
    },

  };
  return mapImpl;
}
