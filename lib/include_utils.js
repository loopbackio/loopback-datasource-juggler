module.exports.buildOneToOneIdentityMap = buildOneToOneIdentityMap;
module.exports.buildOneToManyIdentityMap = buildOneToManyIdentityMap;
module.exports.join = join;
/**
 * Effectivly builds associative map on id -> object relation.
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
