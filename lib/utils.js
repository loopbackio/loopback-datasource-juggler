exports.safeRequire = safeRequire;
exports.fieldsToArray = fieldsToArray;
exports.selectFields = selectFields;
exports.removeUndefined = removeUndefined;
exports.parseSettings = parseSettings;
exports.mergeSettings = exports.deepMerge = mergeSettings;
exports.isPlainObject = isPlainObject;
exports.defineCachedRelations = defineCachedRelations;
exports.sortObjectsByIds = sortObjectsByIds;
exports.setScopeValuesFromWhere = setScopeValuesFromWhere;
exports.mergeQuery = mergeQuery;
exports.mergeIncludes = mergeIncludes;
exports.createPromiseCallback = createPromiseCallback;
exports.uniq = uniq;

var traverse = require('traverse');
var assert = require('assert');

function safeRequire(module) {
  try {
    return require(module);
  } catch (e) {
    console.log('Run "npm install loopback-datasource-juggler ' + module
      + '" command to use loopback-datasource-juggler using ' + module
      + ' database engine');
    process.exit(1);
  }
}

/*
 * Extracting fixed property values for the scope from the where clause into
 * the data object
 *
 * @param {Object} The data object
 * @param {Object} The where clause
 */
function setScopeValuesFromWhere(data, where, targetModel) {
  for (var i in where) {
    if (i === 'and') {
      // Find fixed property values from each subclauses
      for (var w = 0, n = where[i].length; w < n; w++) {
        setScopeValuesFromWhere(data, where[i][w], targetModel);
      }
      continue;
    }
    var prop = targetModel.definition.properties[i];
    if (prop) {
      var val = where[i];
      if (typeof val !== 'object' || val instanceof prop.type
        || prop.type.name === 'ObjectID') // MongoDB key
      {
        // Only pick the {propertyName: propertyValue}
        data[i] = where[i];
      }
    }
  }
}

/**
 * Merge include options of default scope with runtime include option.
 * exhibits the _.extend behaviour. Property value of source overrides
 * property value of destination if property name collision occurs
 * @param {String|Array|Object} destination The default value of `include` option
 * @param {String|Array|Object} source The runtime value of `include` option
 * @returns {Object}
 */
function mergeIncludes(destination, source) {
  var destArray = convertToArray(destination);
  var sourceArray = convertToArray(source);
  if (destArray.length === 0) {
    return sourceArray;
  }
  if (sourceArray.length === 0) {
    return destArray;
  }
  var relationNames = [];
  var resultArray = [];
  for (var j in sourceArray) {
    var sourceEntry = sourceArray[j];
    var sourceEntryRelationName = (typeof (sourceEntry.rel || sourceEntry.relation) === 'string') ?
      sourceEntry.relation : Object.keys(sourceEntry)[0];
    relationNames.push(sourceEntryRelationName);
    resultArray.push(sourceEntry);
  }
  for (var i in destArray) {
    var destEntry = destArray[i];
    var destEntryRelationName = (typeof (destEntry.rel || destEntry.relation) === 'string') ?
      destEntry.relation : Object.keys(destEntry)[0];
    if (relationNames.indexOf(destEntryRelationName) === -1) {
      resultArray.push(destEntry);
    }
  }
  return resultArray;
}

/**
 * Converts input parameter into array of objects which wraps the value.
 * "someValue" is converted to [{"someValue":true}]
 * ["someValue"] is converted to [{"someValue":true}]
 * {"someValue":true} is converted to [{"someValue":true}]
 * @param {String|Array|Object} param - Input parameter to be converted
 * @returns {Array}
 */
function convertToArray(include) {
  if (typeof include === 'string') {
    var obj = {};
    obj[include] = true;
    return [obj];
  } else if (isPlainObject(include)) {
    //if include is of the form - {relation:'',scope:''}
    if (include.rel || include.relation) {
      return [include];
    }
    // Build an array of key/value pairs
    var newInclude = [];
    for (var key in include) {
      var obj = {};
      obj[key] = include[key];
      newInclude.push(obj);
    }
    return newInclude;
  } else if (Array.isArray(include)) {
    var normalized = [];
    for (var i in include) {
      var includeEntry = include[i];
      if (typeof includeEntry === 'string') {
        var obj = {};
        obj[includeEntry] = true;
        normalized.push(obj)
      }
      else{
        normalized.push(includeEntry);
      }
    }
    return normalized;
  }
  return [];
}

/*!
 * Merge query parameters
 * @param {Object} base The base object to contain the merged results
 * @param {Object} update The object containing updates to be merged
 * @param {Object} spec Optionally specifies parameters to exclude (set to false)
 * @returns {*|Object} The base object
 * @private
 */
function mergeQuery(base, update, spec) {
  if (!update) {
    return;
  }
  spec = spec || {};
  base = base || {};

  if (update.where && Object.keys(update.where).length > 0) {
    if (base.where && Object.keys(base.where).length > 0) {
      base.where = {and: [base.where, update.where]};
    } else {
      base.where = update.where;
    }
  }

  // Merge inclusion
  if (spec.include !== false && update.include) {
    if (!base.include) {
      base.include = update.include;
    } else {
      if (spec.nestedInclude === true){
        //specify nestedInclude=true to force nesting of inclusions on scoped
        //queries. e.g. In physician.patients.getAsync({include: 'address'}),
        //inclusion should be on patient model, not on physician model.
        var saved = base.include;
        base.include = {};
        base.include[update.include] = saved;
      }
      else{
        //default behaviour of inclusion merge - merge inclusions at the same
        //level. - https://github.com/strongloop/loopback-datasource-juggler/pull/569#issuecomment-95310874
        base.include = mergeIncludes(base.include, update.include);
      }
    }
  }

  if (spec.collect !== false && update.collect) {
    base.collect = update.collect;
  }

  // Overwrite fields
  if (spec.fields !== false && update.fields !== undefined) {
    base.fields = update.fields;
  } else if (update.fields !== undefined) {
    base.fields = [].concat(base.fields).concat(update.fields);
  }

  // set order
  if ((!base.order || spec.order === false) && update.order) {
    base.order = update.order;
  }

  // overwrite pagination
  if (spec.limit !== false && update.limit !== undefined) {
    base.limit = update.limit;
  }

  var skip = spec.skip !== false && spec.offset !== false;

  if (skip && update.skip !== undefined) {
    base.skip = update.skip;
  }

  if (skip && update.offset !== undefined) {
    base.offset = update.offset;
  }

  return base;
}

/**
 * Normalize fields to an array of included properties
 * @param {String|String[]|Object} fields Fields filter
 * @param {String[]} properties Property names
 * @param {Boolean} excludeUnknown To exclude fields that are unknown properties
 * @returns {String[]} An array of included property names
 */
function fieldsToArray(fields, properties, excludeUnknown) {
  if (!fields) return;

  // include all properties by default
  var result = properties;
  var i, n;

  if (typeof fields === 'string') {
    result = [fields];
  } else if (Array.isArray(fields) && fields.length > 0) {
    // No empty array, including all the fields
    result = fields;
  } else if ('object' === typeof fields) {
    // { field1: boolean, field2: boolean ... }
    var included = [];
    var excluded = [];
    var keys = Object.keys(fields);
    if (!keys.length) return;

    for (i = 0, n = keys.length; i < n; i++) {
      var k = keys[i];
      if (fields[k]) {
        included.push(k);
      } else if ((k in fields) && !fields[k]) {
        excluded.push(k);
      }
    }
    if (included.length > 0) {
      result = included;
    } else if (excluded.length > 0) {
      for (i = 0, n = excluded.length; i < n; i++) {
        var index = result.indexOf(excluded[i]);
        result.splice(index, 1);
      }
    }
  }

  var fieldArray = [];
  if (excludeUnknown) {
    for (i = 0, n = result.length; i < n; i++) {
      if (properties.indexOf(result[i]) !== -1) {
        fieldArray.push(result[i]);
      }
    }
  } else {
    fieldArray = result;
  }
  return fieldArray;
}

function selectFields(fields) {
  // map function
  return function (obj) {
    var result = {};
    var key;

    for (var i = 0; i < fields.length; i++) {
      key = fields[i];

      result[key] = obj[key];
    }
    return result;
  };
}

/**
 * Remove undefined values from the queury object
 * @param query
 * @returns {exports.map|*}
 */
function removeUndefined(query) {
  if (typeof query !== 'object' || query === null) {
    return query;
  }
  // WARNING: [rfeng] Use map() will cause mongodb to produce invalid BSON
  // as traverse doesn't transform the ObjectId correctly
  return traverse(query).forEach(function (x) {
    if (x === undefined) {
      this.remove();
    }

    if (!Array.isArray(x) && (typeof x === 'object' && x !== null
      && x.constructor !== Object)) {
      // This object is not a plain object
      this.update(x, true); // Stop navigating into this object
      return x;
    }

    return x;
  });
}

var url = require('url');
var qs = require('qs');

/**
 * Parse a URL into a settings object
 * @param {String} urlStr The URL for connector settings
 * @returns {Object} The settings object
 */
function parseSettings(urlStr) {
  if (!urlStr) {
    return {};
  }
  var uri = url.parse(urlStr, false);
  var settings = {};
  settings.connector = uri.protocol && uri.protocol.split(':')[0]; // Remove the trailing :
  settings.host = settings.hostname = uri.hostname;
  settings.port = uri.port && Number(uri.port); // port is a string
  settings.user = settings.username = uri.auth && uri.auth.split(':')[0]; // <username>:<password>
  settings.password = uri.auth && uri.auth.split(':')[1];
  settings.database = uri.pathname && uri.pathname.split('/')[1];  // remove the leading /
  settings.url = urlStr;
  if (uri.query) {
    var params = qs.parse(uri.query);
    for (var p in params) {
      settings[p] = params[p];
    }
  }
  return settings;
}

/**
 * Merge model settings
 *
 * Folked from https://github.com/nrf110/deepmerge/blob/master/index.js
 *
 * The original function tries to merge array items if they are objects
 *
 * @param {Object} target The target settings object
 * @param {Object} src The source settings object
 * @returns {Object} The merged settings object
 */
function mergeSettings(target, src) {
  var array = Array.isArray(src);
  var dst = array && [] || {};

  if (array) {
    target = target || [];
    dst = dst.concat(target);
    src.forEach(function (e) {
      if (dst.indexOf(e) === -1) {
        dst.push(e);
      }
    });
  } else {
    if (target && typeof target === 'object') {
      Object.keys(target).forEach(function (key) {
        dst[key] = target[key];
      });
    }
    Object.keys(src).forEach(function (key) {
      if (typeof src[key] !== 'object' || !src[key]) {
        dst[key] = src[key];
      }
      else {
        if (!target[key]) {
          dst[key] = src[key]
        } else {
          dst[key] = mergeSettings(target[key], src[key]);
        }
      }
    });
  }

  return dst;
}

/**
 * Define an non-enumerable __cachedRelations property
 * @param {Object} obj The obj to receive the __cachedRelations
 */
function defineCachedRelations(obj) {
  if (!obj.__cachedRelations) {
    Object.defineProperty(obj, '__cachedRelations', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: {}
    });
  }
}

/**
 * Check if the argument is plain object
 * @param {*) obj The obj value
 * @returns {boolean}
 */
function isPlainObject(obj) {
  return (typeof obj === 'object') && (obj !== null)
    && (obj.constructor === Object);
}



function sortObjectsByIds(idName, ids, objects, strict) {
  ids = ids.map(function(id) {
      return (typeof id === 'object') ? String(id) : id;
  });

  var indexOf = function(x) {
    var isObj = (typeof x[idName] === 'object'); // ObjectID
    var id = isObj ? String(x[idName]) : x[idName];
    return ids.indexOf(id);
  };

  var heading = [];
  var tailing = [];

  objects.forEach(function(x) {
    if (typeof x === 'object') {
      var idx = indexOf(x);
      if (strict && idx === -1) return;
      idx === -1 ? tailing.push(x) : heading.push(x);
    }
  });

  heading.sort(function(x, y) {
    var a = indexOf(x);
    var b = indexOf(y);
    if (a === -1 || b === -1) return 1; // last
    if (a === b) return 0;
    if (a > b) return 1;
    if (a < b) return -1;
  });

  return heading.concat(tailing);
};

function createPromiseCallback() {
  var cb;

  if (!global.Promise) {
    cb = function(){};
    cb.promise = {};
    Object.defineProperty(cb.promise, 'then', { get: throwPromiseNotDefined });
    Object.defineProperty(cb.promise, 'catch', { get: throwPromiseNotDefined });
    return cb;
  }

  var promise = new Promise(function (resolve, reject) {
    cb = function (err, data) {
      if (err) return reject(err);
      return resolve(data);
    };
  });
  cb.promise = promise;
  return cb;
}

function throwPromiseNotDefined() {
  throw new Error(
    'Your Node runtime does support ES6 Promises. ' +
    'Set "global.Promise" to your preferred implementation of promises.');
}

/**
 * Dedupe an array
 * @param {Array} an array
 * @returns {Array} an array with unique items
 */
function uniq(a) {
  var uniqArray = [];
  if (!a) {
    return uniqArray;
  }
  assert(Array.isArray(a), 'array argument is required');
  for (var i = 0, n = a.length; i < n; i++) {
    if (a.indexOf(a[i]) === i) {
      uniqArray.push(a[i]);
    }
  }
  return uniqArray;
}
