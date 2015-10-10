module.exports.buildOneToOneIdentityMap = buildOneToOneIdentityMap;
module.exports.buildOneToManyIdentityMap = buildOneToManyIdentityMap;
module.exports.buildOneToOneIdentityMapWithOrigKeys = buildOneToOneIdentityMapWithOrigKeys;
module.exports.join = join;
/**
 * Effectively builds associative map on id -> object relation.
 * Map returned in form of object with ids in keys and object as values.
 * @param objs array of objects to build from
 * @param idName name of property to be used as id. Such property considered to be unique across array.
 * In case of collisions last wins. For non-unique ids use buildOneToManyIdentityMap()
 * @returns {{}} object where keys are ids and values are objects itself
 */
function buildOneToOneIdentityMap(objs, idName) {
  var idMap = {};
  for(var i = 0; i < objs.length; i++) {
    var obj = objs[i];
    var id = obj[idName].toString();
    idMap[id] = obj;
  }
  return idMap;
}

/**
 * Builds key -> value map on js object base. As js object keys can be only strings keys are stored on value side.
 * So, each value should be an object like that:
 * { origKey: 34, value: {...}}
 * origKey field name should be passed as parameter to function.
 *
 * @param origKeyField filed name on value side to pick original key from.
 * @returns empty object to be filled with key-value pair and additional methods `keys` and `originalKeys`
 */
function newIdMap(origKeyField, valueField) {
  //var idMap = Object.create(null); // not any single properties within our identity map
  var idMap = {};
  Object.defineProperty(idMap, "set", {
    value: function(origKey, value){
      var key = origKey.toString();
      this[key] = {};
      this[key][origKeyField] = origKey;
      this[key][valueField] = value;
    }
  });
  Object.defineProperty(idMap, "keys", {    // can ask for keys simply by idMap.keys
    get: function(){ return Object.keys(this); },
    enumerable: false // explicitly non-enumerable
  });
  Object.defineProperty(idMap, "originalKeys", {  // can ask for all original keys by idMap.originalKeys
    get: function(){
      var keys = this.keys;
      var origKeys = [];
      for(var i = 0; i < keys.length; i++) {
        var origKey = this[keys[i]][origKeyField];
        origKeys.push(origKey);
      }
      return origKeys;
    },
    enumerable: false // explicitly non-enumerable
  });
  Object.defineProperty(idMap, "simplified",{
    get: function(){
      var keys = this.keys;
      var simplified = {};
      for(var i = 0; i < keys.length; i++) {
        var key = keys[i];
        simplified[key] = this[key][valueField];
      }
      return simplified;
    }
  });
  return idMap;
}
/**
 * Effectively builds associative map on id -> object relation and stores original keys.
 * Map returned in form of object with ids in keys and object as values.
 * @param objs array of objects to build from
 * @param idName name of property to be used as id. Such property considered to be unique across array.
 * In case of collisions last wins. For non-unique ids use buildOneToManyIdentityMap()
 * @returns {{}} object where keys are ids and values are objects itself
 */
function buildOneToOneIdentityMapWithOrigKeys(objs, idName) {
  var idMap = newIdMap("originalKey", "value");

  for(var i = 0; i < objs.length; i++) {
    var obj = objs[i];
    var id = obj[idName];
    idMap.set(id, obj);
  }
  return idMap;
}

/**
 * Effectively builds associate map on id -> Array[Object].
 * Map returned in form of object with ids in keys and array of objects with given id.
 * @param objs array of objects to build from
 * @param idName name of property to be used as id
 */
function buildOneToManyIdentityMap(objs, idName) {
  var idMap = {};
  for(var i = 0; i < objs.length; i++) {
    var obj = objs[i];
    var id = obj[idName].toString();
    if(id in idMap) {
      idMap[id].push(obj);
    } else {
      idMap[id] = [obj];
    }
  }
  return idMap;
}

function buildOneToManyIdentityMapWithOrigKeys(objs, idName) {
  var idMap = newIdMap("originalKey", "value");
  for(var i = 0; i < objs.length; i++) {
    var obj = objs[i];
    var id = obj[idName];
    var idString = id.toString();
    if(idString in idMap) {
      idMap[idString]["value"].push(obj);
    } else {
      idMap.set(id, [obj]);
    }
  }
  return idMap;
}


/**
 * Yeah, it joins. You need three things id -> obj1 map, id -> [obj2] map and merge function.
 * This functions will take each obj1, locate all data to join in map2 and call merge function.
 * @param oneToOneIdMap
 * @param oneToManyIdMap
 * @param mergeF  function(obj, objectsToMergeIn)
 */
function join(oneToOneIdMap, oneToManyIdMap, mergeF) {
  var ids = Object.keys(oneToOneIdMap);
  for(var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var obj = oneToOneIdMap[id];
    var objectsToMergeIn = oneToManyIdMap[id] || [];
    mergeF(obj, objectsToMergeIn);
  }
}
