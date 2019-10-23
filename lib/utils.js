// Copyright IBM Corp. 2012,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

exports.safeRequire = safeRequire;
exports.fieldsToArray = fieldsToArray;
exports.selectFields = selectFields;
exports.sanitizeQuery = sanitizeQuery;
exports.parseSettings = parseSettings;
exports.mergeSettings = exports.deepMerge = deepMerge;
exports.deepMergeProperty = deepMergeProperty;
exports.isPlainObject = isPlainObject;
exports.defineCachedRelations = defineCachedRelations;
exports.sortObjectsByIds = sortObjectsByIds;
exports.setScopeValuesFromWhere = setScopeValuesFromWhere;
exports.mergeQuery = mergeQuery;
exports.mergeIncludes = mergeIncludes;
exports.createPromiseCallback = createPromiseCallback;
exports.uniq = uniq;
exports.toRegExp = toRegExp;
exports.hasRegExpFlags = hasRegExpFlags;
exports.idEquals = idEquals;
exports.findIndexOf = findIndexOf;
exports.collectTargetIds = collectTargetIds;
exports.idName = idName;
exports.rankArrayElements = rankArrayElements;
exports.idsHaveDuplicates = idsHaveDuplicates;
exports.isClass = isClass;
exports.escapeRegExp = escapeRegExp;
exports.applyParentProperty = applyParentProperty;

const g = require('strong-globalize')();
const traverse = require('traverse');
const assert = require('assert');
const debug = require('debug')('loopback:juggler:utils');

/**
 * The name of the property in modelBuilder settings that will enable the child parent reference functionality
 * @type {string}
 */
const BUILDER_PARENT_SETTING = 'parentRef';

/**
 * The property name that should be defined on each child instance if parent feature flag enabled
 * @type {string}
 */
const PARENT_PROPERTY_NAME = '__parent';

function safeRequire(module) {
  try {
    return require(module);
  } catch (e) {
    g.log('Run "{{npm install loopback-datasource-juggler}} %s" command ',
      'to use {{loopback-datasource-juggler}} using %s database engine',
      module, module);
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
  for (const i in where) {
    if (i === 'and') {
      // Find fixed property values from each subclauses
      for (let w = 0, n = where[i].length; w < n; w++) {
        setScopeValuesFromWhere(data, where[i][w], targetModel);
      }
      continue;
    }
    const prop = targetModel.definition.properties[i];
    if (prop) {
      const val = where[i];
      if (typeof val !== 'object' || val instanceof prop.type ||
          prop.type.name === 'ObjectID' || // MongoDB key
          prop.type.name === 'uuidFromString') { // C*
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
  const destArray = convertToArray(destination);
  const sourceArray = convertToArray(source);
  if (destArray.length === 0) {
    return sourceArray;
  }
  if (sourceArray.length === 0) {
    return destArray;
  }
  const relationNames = [];
  const resultArray = [];
  for (const j in sourceArray) {
    const sourceEntry = sourceArray[j];
    const sourceEntryRelationName = (typeof (sourceEntry.rel || sourceEntry.relation) === 'string') ?
      sourceEntry.relation : Object.keys(sourceEntry)[0];
    relationNames.push(sourceEntryRelationName);
    resultArray.push(sourceEntry);
  }
  for (const i in destArray) {
    const destEntry = destArray[i];
    const destEntryRelationName = (typeof (destEntry.rel || destEntry.relation) === 'string') ?
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
    const obj = {};
    obj[include] = true;
    return [obj];
  } else if (isPlainObject(include)) {
    // if include is of the form - {relation:'',scope:''}
    if (include.rel || include.relation) {
      return [include];
    }
    // Build an array of key/value pairs
    const newInclude = [];
    for (const key in include) {
      const obj = {};
      obj[key] = include[key];
      newInclude.push(obj);
    }
    return newInclude;
  } else if (Array.isArray(include)) {
    const normalized = [];
    for (const i in include) {
      const includeEntry = include[i];
      if (typeof includeEntry === 'string') {
        const obj = {};
        obj[includeEntry] = true;
        normalized.push(obj);
      } else {
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
      if (spec.nestedInclude === true) {
        // specify nestedInclude=true to force nesting of inclusions on scoped
        // queries. e.g. In physician.patients.find({include: 'address'}),
        // inclusion should be on patient model, not on physician model.
        const saved = base.include;
        base.include = {};
        base.include[update.include] = saved;
      } else {
        // default behaviour of inclusion merge - merge inclusions at the same
        // level. - https://github.com/strongloop/loopback-datasource-juggler/pull/569#issuecomment-95310874
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

  const skip = spec.skip !== false && spec.offset !== false;

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
  let result = properties;
  let i, n;

  if (typeof fields === 'string') {
    result = [fields];
  } else if (Array.isArray(fields) && fields.length > 0) {
    // No empty array, including all the fields
    result = fields;
  } else if ('object' === typeof fields) {
    // { field1: boolean, field2: boolean ... }
    const included = [];
    const excluded = [];
    const keys = Object.keys(fields);
    if (!keys.length) return;

    for (i = 0, n = keys.length; i < n; i++) {
      const k = keys[i];
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
        const index = result.indexOf(excluded[i]);
        if (index !== -1) result.splice(index, 1); // only when existing field excluded
      }
    }
  }

  let fieldArray = [];
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
  return function(obj) {
    const result = {};
    let key;

    for (let i = 0; i < fields.length; i++) {
      key = fields[i];

      result[key] = obj[key];
    }
    return result;
  };
}

function isProhibited(key, prohibitedKeys) {
  if (!prohibitedKeys || !prohibitedKeys.length) return false;
  if (typeof key !== 'string') {
    return false;
  }
  for (const k of prohibitedKeys) {
    if (k === key) return true;
    // x.secret, secret.y, or x.secret.y
    if (key.split('.').indexOf(k) !== -1) return true;
  }
  return false;
}

/**
 * Accept an operator key and return whether it is used for a regular expression query or not
 * @param {string} operator
 * @returns {boolean}
 */
function isRegExpOperator(operator) {
  return ['like', 'nlike', 'ilike', 'nilike', 'regexp'].includes(operator);
}

/**
 * Accept a RegExp string and make sure that any special characters for RegExp are escaped in case they
 * create an invalid Regexp
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  assert.strictEqual(typeof str, 'string', 'String required for regexp escaping');
  try {
    new RegExp(str); // try to parse string as regexp
    return str;
  } catch (unused) {
    console.warn(
      'Auto-escaping invalid RegExp value %j supplied by the caller. ' +
      'Please note this behavior may change in the future.',
      str,
    );
    return str.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, '\\$&');
  }
}

/**
 * Sanitize the query object
 * @param query {object} The query object
 * @param options
 * @property normalizeUndefinedInQuery {String} either "nullify", "throw" or "ignore" (default: "ignore")
 * @property prohibitedKeys {String[]} An array of prohibited keys to be removed
 * @returns {*}
 */
function sanitizeQuery(query, options) {
  debug('Sanitizing query object: %j', query);
  if (typeof query !== 'object' || query === null) {
    return query;
  }
  options = options || {};
  if (typeof options === 'string') {
    // Keep it backward compatible
    options = {normalizeUndefinedInQuery: options};
  }
  const prohibitedKeys = options.prohibitedKeys;
  const offendingKeys = [];
  const normalizeUndefinedInQuery = options.normalizeUndefinedInQuery;
  const maxDepth = options.maxDepth || Number.MAX_SAFE_INTEGER;
  // WARNING: [rfeng] Use map() will cause mongodb to produce invalid BSON
  // as traverse doesn't transform the ObjectId correctly
  const result = traverse(query).forEach(function(x) {
    /**
     * Security risk if the client passes in a very deep where object
     */
    if (this.circular) {
      const msg = g.f('The query object is circular');
      const err = new Error(msg);
      err.statusCode = 400;
      err.code = 'QUERY_OBJECT_IS_CIRCULAR';
      throw err;
    }
    if (this.level > maxDepth) {
      const msg = g.f('The query object exceeds maximum depth %d', maxDepth);
      const err = new Error(msg);
      err.statusCode = 400;
      err.code = 'QUERY_OBJECT_TOO_DEEP';
      throw err;
    }
    /**
     * Make sure prohibited keys are removed from the query to prevent
     * sensitive values from being guessed
     */
    if (isProhibited(this.key, prohibitedKeys)) {
      offendingKeys.push(this.key);
      this.remove();
      return;
    }

    /**
     * Handle undefined values
     */
    if (x === undefined) {
      switch (normalizeUndefinedInQuery) {
        case 'nullify':
          this.update(null);
          break;
        case 'throw':
          throw new Error(g.f('Unexpected `undefined` in query'));
        case 'ignore':
        default:
          this.remove();
      }
    }

    if (!Array.isArray(x) && (typeof x === 'object' && x !== null &&
        x.constructor !== Object)) {
      // This object is not a plain object
      this.update(x, true); // Stop navigating into this object
      return x;
    }

    if (isRegExpOperator(this.key) && typeof x === 'string') { // we have regexp supporting operator and string to escape
      return escapeRegExp(x);
    }

    return x;
  });

  if (offendingKeys.length) {
    console.error(
      g.f(
        'Potential security alert: hidden/protected properties %j are used in query.',
        offendingKeys,
      ),
    );
  }
  return result;
}

const url = require('url');
const qs = require('qs');

/**
 * Parse a URL into a settings object
 * @param {String} urlStr The URL for connector settings
 * @returns {Object} The settings object
 */
function parseSettings(urlStr) {
  if (!urlStr) {
    return {};
  }
  const uri = url.parse(urlStr, false);
  const settings = {};
  settings.connector = uri.protocol && uri.protocol.split(':')[0]; // Remove the trailing :
  settings.host = settings.hostname = uri.hostname;
  settings.port = uri.port && Number(uri.port); // port is a string
  settings.user = settings.username = uri.auth && uri.auth.split(':')[0]; // <username>:<password>
  settings.password = uri.auth && uri.auth.split(':')[1];
  settings.database = uri.pathname && uri.pathname.split('/')[1]; // remove the leading /
  settings.url = urlStr;
  if (uri.query) {
    const params = qs.parse(uri.query);
    for (const p in params) {
      settings[p] = params[p];
    }
  }
  return settings;
}

/**
 * Objects deep merge
 *
 * Forked from https://github.com/nrf110/deepmerge/blob/master/index.js
 *
 * The original function tries to merge array items if they are objects, this
 * was changed to always push new items in arrays, independently of their type.
 *
 * NOTE: The function operates as a deep clone when called with a single object
 * argument.
 *
 * @param {Object} base The base object
 * @param {Object} extras The object to merge with base
 * @returns {Object} The merged object
 */
function deepMerge(base, extras) {
  // deepMerge allows undefined extras to allow deep cloning of arrays
  const array = Array.isArray(base) && (Array.isArray(extras) || !extras);
  let dst = array && [] || {};

  if (array) {
    // extras or base is an array
    extras = extras || [];
    // Add items from base into dst
    dst = dst.concat(base);
    // Add non-existent items from extras into dst
    extras.forEach(function(e) {
      if (dst.indexOf(e) === -1) {
        dst.push(e);
      }
    });
  } else {
    if (base != null && typeof base === 'object') {
      // Add properties from base to dst
      Object.keys(base).forEach(function(key) {
        if (base[key] && typeof base[key] === 'object') {
          // call deepMerge on nested object to operate a deep clone
          dst[key] = deepMerge(base[key]);
        } else {
          dst[key] = base[key];
        }
      });
    }
    if (extras != null && typeof extras === 'object') {
      // extras is an object {}
      Object.keys(extras).forEach(function(key) {
        const extra = extras[key];
        if (extra == null || typeof extra !== 'object') {
          // extra item value is null, undefined or not an object
          dst[key] = extra;
        } else {
          // The extra item value is an object
          if (base == null || typeof base !== 'object' ||
            base[key] == null) {
            // base is not an object or base item value is undefined or null
            dst[key] = extra;
          } else {
            // call deepMerge on nested object
            dst[key] = deepMerge(base[key], extra);
          }
        }
      });
    }
  }

  return dst;
}

/**
 * Properties deep merge
 * Similar as deepMerge but also works on single properties of any type
 *
 * @param {Object} base The base property
 * @param {Object} extras The property to merge with base
 * @returns {Object} The merged property
 */
function deepMergeProperty(base, extras) {
  const mergedObject = deepMerge({key: base}, {key: extras});
  const mergedProperty = mergedObject.key;
  return mergedProperty;
}

const numberIsFinite = Number.isFinite || function(value) {
  return typeof value === 'number' && isFinite(value);
};

/**
 * Adds a property __rank to array elements of type object {}
 * If an inner element already has the __rank property it is not altered
 * NOTE: the function mutates the provided array
 *
 * @param array The original array
 * @param rank The rank to apply to array elements
 * @return rankedArray The original array with newly ranked elements
 */
function rankArrayElements(array, rank) {
  if (!Array.isArray(array) || !numberIsFinite(rank))
    return array;

  array.forEach(function(el) {
    // only apply ranking on objects {} in array
    if (!el || typeof el != 'object' || Array.isArray(el))
      return;

    // property rank is already defined for array element
    if (el.__rank)
      return;

    // define rank property as non-enumerable and read-only
    Object.defineProperty(el, '__rank', {
      writable: false,
      enumerable: false,
      configurable: false,
      value: rank,
    });
  });
  return array;
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
      value: {},
    });
  }
}

/**
 * Check if the argument is plain object
 * @param {*} obj The obj value
 * @returns {boolean}
 */
function isPlainObject(obj) {
  return (typeof obj === 'object') && (obj !== null) &&
    (obj.constructor === Object);
}

function sortObjectsByIds(idName, ids, objects, strict) {
  ids = ids.map(function(id) {
    return (typeof id === 'object') ? String(id) : id;
  });

  const indexOf = function(x) {
    const isObj = (typeof x[idName] === 'object'); // ObjectID
    const id = isObj ? String(x[idName]) : x[idName];
    return ids.indexOf(id);
  };

  const heading = [];
  const tailing = [];

  objects.forEach(function(x) {
    if (typeof x === 'object') {
      const idx = indexOf(x);
      if (strict && idx === -1) return;
      idx === -1 ? tailing.push(x) : heading.push(x);
    }
  });

  heading.sort(function(x, y) {
    const a = indexOf(x);
    const b = indexOf(y);
    if (a === -1 || b === -1) return 1; // last
    if (a === b) return 0;
    if (a > b) return 1;
    if (a < b) return -1;
  });

  return heading.concat(tailing);
}

function createPromiseCallback() {
  let cb;
  const promise = new Promise(function(resolve, reject) {
    cb = function(err, data) {
      if (err) return reject(err);
      return resolve(data);
    };
  });
  cb.promise = promise;
  return cb;
}

function isBsonType(value) {
  // bson@1.x stores _bsontype on ObjectID instance, bson@4.x on prototype
  return value.hasOwnProperty('_bsontype') ||
    value.constructor.prototype.hasOwnProperty('_bsontype');
}

/**
 * Dedupe an array
 * @param {Array} an array
 * @returns {Array} an array with unique items
 */
function uniq(a) {
  const uniqArray = [];
  if (!a) {
    return uniqArray;
  }
  assert(Array.isArray(a), 'array argument is required');
  const comparableA = a.map(
    item => isBsonType(item) ? item.toString() : item,
  );
  for (let i = 0, n = comparableA.length; i < n; i++) {
    if (comparableA.indexOf(comparableA[i]) === i) {
      uniqArray.push(a[i]);
    }
  }
  return uniqArray;
}

/**
 * Converts a string, regex literal, or a RegExp object to a RegExp object.
 * @param {String|Object} The string, regex literal, or RegExp object to convert
 * @returns {Object} A RegExp object
 */
function toRegExp(regex) {
  const isString = typeof regex === 'string';
  const isRegExp = regex instanceof RegExp;

  if (!(isString || isRegExp))
    return new Error(g.f('Invalid argument, must be a string, {{regex}} literal, or ' +
        '{{RegExp}} object'));

  if (isRegExp)
    return regex;

  if (!hasRegExpFlags(regex))
    return new RegExp(regex);

  // only accept i, g, or m as valid regex flags
  const flags = regex.split('/').pop().split('');
  const validFlags = ['i', 'g', 'm'];
  const invalidFlags = [];
  flags.forEach(function(flag) {
    if (validFlags.indexOf(flag) === -1)
      invalidFlags.push(flag);
  });

  const hasInvalidFlags = invalidFlags.length > 0;
  if (hasInvalidFlags)
    return new Error(g.f('Invalid {{regex}} flags: %s', invalidFlags));

  // strip regex delimiter forward slashes
  const expression = regex.substr(1, regex.lastIndexOf('/') - 1);
  return new RegExp(expression, flags.join(''));
}

function hasRegExpFlags(regex) {
  return regex instanceof RegExp ?
    regex.toString().split('/').pop() :
    !!regex.match(/.*\/.+$/);
}

// Compare two id values to decide if updateAttributes is trying to change
// the id value for a given instance
function idEquals(id1, id2) {
  if (id1 === id2) {
    return true;
  }
  // Allows number/string conversions
  if ((typeof id1 === 'number' && typeof id2 === 'string') ||
    (typeof id1 === 'string' && typeof id2 === 'number')) {
    return id1 == id2;
  }
  // For complex id types such as MongoDB ObjectID
  id1 = JSON.stringify(id1);
  id2 = JSON.stringify(id2);
  if (id1 === id2) {
    return true;
  }

  return false;
}

// Defaults to native Array.prototype.indexOf when no idEqual is present
// Otherwise, returns the lowest index for which isEqual(arr[]index, target) is true
function findIndexOf(arr, target, isEqual) {
  if (!isEqual) {
    return arr.indexOf(target);
  }

  for (let i = 0; i < arr.length; i++) {
    if (isEqual(arr[i], target)) { return i; }
  }

  return -1;
}

/**
 * Returns an object that queries targetIds.
 * @param {Array} The array of targetData
 * @param {String} The Id property name of target model
 * @returns {Object} The object that queries targetIds
 */
function collectTargetIds(targetData, idPropertyName) {
  const targetIds = [];
  for (let i = 0; i < targetData.length; i++) {
    const targetId = targetData[i][idPropertyName];
    targetIds.push(targetId);
  }
  const IdQuery = {
    inq: uniq(targetIds),
  };
  return IdQuery;
}

/**
 * Find the idKey of a Model.
 * @param {ModelConstructor} m - Model Constructor
 * @returns {String}
 */
function idName(m) {
  return m.definition.idName() || 'id';
}

/**
 * Check a list of IDs to see if there are any duplicates.
 *
 * @param {Array} The array of IDs to check
 * @returns {boolean} If any duplicates were found
 */
function idsHaveDuplicates(ids) {
  // use Set if available and all ids are of string or number type
  let hasDuplicates = undefined;
  let i, j;
  if (typeof Set === 'function') {
    const uniqueIds = new Set();
    for (i = 0; i < ids.length; ++i) {
      const idType = typeof ids[i];
      if (idType === 'string' || idType === 'number') {
        if (uniqueIds.has(ids[i])) {
          hasDuplicates = true;
          break;
        } else {
          uniqueIds.add(ids[i]);
        }
      } else {
        // ids are not all string/number that can be checked via Set, stop and do the slow test
        break;
      }
    }
    if (hasDuplicates === undefined && uniqueIds.size === ids.length) {
      hasDuplicates = false;
    }
  }
  if (hasDuplicates === undefined) {
    // fast check was inconclusive or unavailable, do the slow check
    // can still optimize this by doing 1/2 N^2 instead of the full N^2
    for (i = 0; i < ids.length && hasDuplicates === undefined; ++i) {
      for (j = 0; j < i; ++j) {
        if (idEquals(ids[i], ids[j])) {
          hasDuplicates = true;
          break;
        }
      }
    }
  }
  return hasDuplicates === true;
}

function isClass(fn) {
  return fn && fn.toString().startsWith('class ');
}

/**
 * Accept an element, and attach the __parent property to it, unless no object given, while also
 * making sure to check for already created properties
 *
 * @param {object} element
 * @param {Model} parent
 */
function applyParentProperty(element, parent) {
  assert.strictEqual(typeof element, 'object', 'Non object element given to assign parent');
  const {constructor: {modelBuilder: {settings: builderSettings} = {}} = {}} = element;
  if (!builderSettings || !builderSettings[BUILDER_PARENT_SETTING]) {
    // parentRef flag not enabled on ModelBuilder settings
    return;
  }

  if (element.hasOwnProperty(PARENT_PROPERTY_NAME)) {
    // property already created on model, just assign
    const existingParent = element[PARENT_PROPERTY_NAME];
    if (existingParent && existingParent !== parent) {
      // parent re-assigned (child model assigned to other model instance)
      g.warn('Re-assigning child model instance to another parent than the original!\n' +
        'Although supported, this is not a recommended practice: ' +
        `${element.constructor.name} -> ${parent.constructor.name}\n` +
        'You should create an independent copy of the child model using `new Model(CHILD)` OR ' +
        '`new Model(CHILD.toJSON())` and assign to new parent');
    }
    element[PARENT_PROPERTY_NAME] = parent;
  } else {
    // first time defining the property on the element
    Object.defineProperty(element, PARENT_PROPERTY_NAME, {
      value: parent,
      writable: true,
      enumerable: false,
      configurable: false,
    });
  }
}
