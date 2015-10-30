module.exports.buildOneToOneIdentityMapWithOrigKeys = buildOneToOneIdentityMapWithOrigKeys;
module.exports.buildOneToManyIdentityMapWithOrigKeys = buildOneToManyIdentityMapWithOrigKeys;
module.exports.join = join;
module.exports.KVMap = KVMap;

/**
 * Effectively builds associative map on id -> object relation and stores original keys.
 * Map returned in form of object with ids in keys and object as values.
 * @param objs array of objects to build from
 * @param idName name of property to be used as id. Such property considered to be unique across array.
 * In case of collisions last wins. For non-unique ids use buildOneToManyIdentityMap()
 * @returns {} object where keys are ids and values are objects itself
 */
function buildOneToOneIdentityMapWithOrigKeys(objs, idName) {
  var kvMap = new KVMap();
  for(var i = 0; i < objs.length; i++) {
    var obj = objs[i];
    var id = obj[idName];
    kvMap.set(id, obj);
  }
  return kvMap;
}

function buildOneToManyIdentityMapWithOrigKeys(objs, idName) {
  var kvMap = new KVMap();
  for(var i = 0; i < objs.length; i++) {
    var obj = objs[i];
    var id = obj[idName];
    var value = kvMap.get(id) || [];
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
  var ids = oneToOneIdMap.getKeys();
  for(var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var obj = oneToOneIdMap.get(id);
    var objectsToMergeIn = oneToManyIdMap.get(id) || [];
    mergeF(obj, objectsToMergeIn);
  }
}


/**
 * Map with arbitrary keys and values. User .set() and .get() to work with values instead of []
 * @returns {{set: Function, get: Function, remove: Function, exist: Function, getKeys: Function}}
 * @constructor
 */
function KVMap(){
  var _originalKeyFieldName = 'originalKey';
  var _valueKeyFieldName = 'value';
  var _dict = {};
  var keyToString = function(key){ return key.toString() };
  var mapImpl = {
    set: function(key, value){
      var recordObj = {};
      recordObj[_originalKeyFieldName] = key;
      recordObj[_valueKeyFieldName] = value;
      _dict[keyToString(key)] = recordObj;
      return true;
    },
    get: function(key){
      var storeObj = _dict[keyToString(key)];
      if(storeObj) {
        return storeObj[_valueKeyFieldName];
      } else {
        return undefined;
      }
    },
    remove: function(key){
      delete _dict[keyToString(key)];
      return true;
    },
    exist: function(key) {
      var result = _dict.hasOwnProperty(keyToString(key));
      return result;
    },
    getKeys: function(){
      var result = [];
      for(var key in _dict) {
        result.push(_dict[key][_originalKeyFieldName]);
      }
      return result;
    }

  };
  return mapImpl;
}
