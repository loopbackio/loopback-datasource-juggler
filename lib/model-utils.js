// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// Turning on strict for this file breaks lots of test cases;
// disabling strict for this file
/* eslint-disable strict */

module.exports = ModelUtils;

/*!
 * Module dependencies
 */
var g = require('strong-globalize')();
var geo = require('./geo');
var utils = require('./utils');
var fieldsToArray = utils.fieldsToArray;
var sanitizeQueryOrData = utils.sanitizeQuery;
var BaseModel = require('./model');

/**
 * A mixin to contain utility methods for DataAccessObject
 */
function ModelUtils() {
}

/**
 * Verify if allowExtendedOperators is enabled
 * @options {Object} [options] Optional options to use.
 * @property {Boolean} allowExtendedOperators.
 * @returns {Boolean} Returns `true` if allowExtendedOperators is enabled, else `false`.
 */
ModelUtils._allowExtendedOperators = function(options) {
  const flag = this._getSetting('allowExtendedOperators', options);
  if (flag != null) return !!flag;
  // Default to `false`
  return false;
};

/**
 * Get settings via hierarchical determination
 * - method level options
 * - model level settings
 * - data source level settings
 *
 * @param {String} key The setting key
 */
ModelUtils._getSetting = function(key, options) {
  // Check method level options
  var val = options && options[key];
  if (val !== undefined) return val;
  // Check for settings in model
  var m = this.definition;
  if (m && m.settings) {
    val = m.settings[key];
    if (val !== undefined) {
      return m.settings[key];
    }
    // Fall back to data source level
  }

  // Check for settings in connector
  var ds = this.getDataSource();
  if (ds && ds.settings) {
    return ds.settings[key];
  }

  return undefined;
};

var operators = {
  eq: '=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  between: 'BETWEEN',
  inq: 'IN',
  nin: 'NOT IN',
  neq: '!=',
  like: 'LIKE',
  nlike: 'NOT LIKE',
  ilike: 'ILIKE',
  nilike: 'NOT ILIKE',
  regexp: 'REGEXP',
};

/*
 * Normalize the filter object and throw errors if invalid values are detected
 * @param {Object} filter The query filter object
 * @options {Object} [options] Optional options to use.
 * @property {Boolean} allowExtendedOperators.
 * @returns {Object} The normalized filter object
 * @private
 */
ModelUtils._normalize = function(filter, options) {
  if (!filter) {
    return undefined;
  }
  var err = null;
  if ((typeof filter !== 'object') || Array.isArray(filter)) {
    err = new Error(g.f('The query filter %j is not an {{object}}', filter));
    err.statusCode = 400;
    throw err;
  }
  if (filter.limit || filter.skip || filter.offset) {
    var limit = Number(filter.limit || 100);
    var offset = Number(filter.skip || filter.offset || 0);
    if (isNaN(limit) || limit <= 0 || Math.ceil(limit) !== limit) {
      err = new Error(g.f('The {{limit}} parameter %j is not valid',
        filter.limit));
      err.statusCode = 400;
      throw err;
    }
    if (isNaN(offset) || offset < 0 || Math.ceil(offset) !== offset) {
      err = new Error(g.f('The {{offset/skip}} parameter %j is not valid',
        filter.skip || filter.offset));
      err.statusCode = 400;
      throw err;
    }
    filter.limit = limit;
    filter.offset = offset;
    filter.skip = offset;
  }

  if (filter.order) {
    var order = filter.order;
    if (!Array.isArray(order)) {
      order = [order];
    }
    var fields = [];
    for (var i = 0, m = order.length; i < m; i++) {
      if (typeof order[i] === 'string') {
        // Normalize 'f1 ASC, f2 DESC, f3' to ['f1 ASC', 'f2 DESC', 'f3']
        var tokens = order[i].split(/(?:\s*,\s*)+/);
        for (var t = 0, n = tokens.length; t < n; t++) {
          var token = tokens[t];
          if (token.length === 0) {
            // Skip empty token
            continue;
          }
          var parts = token.split(/\s+/);
          if (parts.length >= 2) {
            var dir = parts[1].toUpperCase();
            if (dir === 'ASC' || dir === 'DESC') {
              token = parts[0] + ' ' + dir;
            } else {
              err = new Error(g.f('The {{order}} %j has invalid direction', token));
              err.statusCode = 400;
              throw err;
            }
          }
          fields.push(token);
        }
      } else {
        err = new Error(g.f('The order %j is not valid', order[i]));
        err.statusCode = 400;
        throw err;
      }
    }
    if (fields.length === 1 && typeof filter.order === 'string') {
      filter.order = fields[0];
    } else {
      filter.order = fields;
    }
  }

  // normalize fields as array of included property names
  if (filter.fields) {
    filter.fields = fieldsToArray(filter.fields,
      Object.keys(this.definition.properties), this.settings.strict);
  }

  filter = this._sanitizeQuery(filter, options);
  this._coerce(filter.where, options);
  return filter;
};

function DateType(arg) {
  var d = new Date(arg);
  if (isNaN(d.getTime())) {
    throw new Error(g.f('Invalid date: %s', arg));
  }
  return d;
}

function BooleanType(arg) {
  if (typeof arg === 'string') {
    switch (arg) {
      case 'true':
      case '1':
        return true;
      case 'false':
      case '0':
        return false;
    }
  }
  if (arg == null) {
    return null;
  }
  return Boolean(arg);
}

function NumberType(val) {
  var num = Number(val);
  return !isNaN(num) ? num : val;
}

function coerceArray(val) {
  if (Array.isArray(val)) {
    return val;
  }

  if (!utils.isPlainObject(val)) {
    throw new Error(g.f('Value is not an {{array}} or {{object}} with sequential numeric indices'));
  }

  // It is an object, check if empty
  var props = Object.keys(val);

  if (props.length === 0) {
    throw new Error(g.f('Value is an empty {{object}}'));
  }

  var arrayVal = new Array(props.length);
  for (var i = 0; i < arrayVal.length; ++i) {
    if (!val.hasOwnProperty(i)) {
      throw new Error(g.f('Value is not an {{array}} or {{object}} with sequential numeric indices'));
    }

    arrayVal[i] = val[i];
  }

  return arrayVal;
}

function _normalizeAsArray(result) {
  if (typeof result === 'string') {
    result = [result];
  }
  if (Array.isArray(result)) {
    return result;
  } else {
    // See https://github.com/strongloop/loopback-datasource-juggler/issues/1646
    // `ModelBaseClass` normalize the properties to an object such as `{secret: true}`
    var keys = [];
    for (var k in result) {
      if (result[k]) keys.push(k);
    }
    return keys;
  }
}

/**
 * Get an array of hidden property names
 */
ModelUtils._getHiddenProperties = function() {
  var settings = this.definition.settings || {};
  var result = settings.hiddenProperties || settings.hidden || [];
  return _normalizeAsArray(result);
};

/**
 * Get an array of protected property names
 */
ModelUtils._getProtectedProperties = function() {
  var settings = this.definition.settings || {};
  var result = settings.protectedProperties || settings.protected || [];
  return _normalizeAsArray(result);
};

/**
 * Get the maximum depth of a query object
 */
ModelUtils._getMaxDepthOfQuery = function(options, defaultValue) {
  options = options || {};
  // See https://github.com/strongloop/loopback-datasource-juggler/issues/1651
  var maxDepth = this._getSetting('maxDepthOfQuery', options);
  if (maxDepth == null) {
    maxDepth = defaultValue || 32;
  }
  return +maxDepth;
};

/**
 * Get the maximum depth of a data object
 */
ModelUtils._getMaxDepthOfData = function(options, defaultValue) {
  options = options || {};
  // See https://github.com/strongloop/loopback-datasource-juggler/issues/1651
  var maxDepth = this._getSetting('maxDepthOfData', options);
  if (maxDepth == null) {
    maxDepth = defaultValue || 64;
  }
  return +maxDepth;
};

/**
 * Get the prohibitHiddenPropertiesInQuery flag
 */
ModelUtils._getProhibitHiddenPropertiesInQuery = function(options, defaultValue) {
  var flag = this._getSetting('prohibitHiddenPropertiesInQuery', options);
  if (flag == null) return !!defaultValue;
  return !!flag;
};

/**
 * Sanitize the query object
 */
ModelUtils._sanitizeQuery = function(query, options) {
  options = options || {};

  // Get settings to normalize `undefined` values
  var normalizeUndefinedInQuery = this._getSetting('normalizeUndefinedInQuery', options);
  // Get setting to prohibit hidden/protected properties in query
  var prohibitHiddenPropertiesInQuery = this._getProhibitHiddenPropertiesInQuery(options);

  // See https://github.com/strongloop/loopback-datasource-juggler/issues/1651
  var maxDepthOfQuery = this._getMaxDepthOfQuery(options);

  var prohibitedKeys = [];
  // Check violation of keys
  if (prohibitHiddenPropertiesInQuery) {
    prohibitedKeys = this._getHiddenProperties();
    if (options.prohibitProtectedPropertiesInQuery) {
      prohibitedKeys = prohibitedKeys.concat(this._getProtectedProperties());
    }
  }
  return sanitizeQueryOrData(query,
    Object.assign({
      maxDepth: maxDepthOfQuery,
      prohibitedKeys: prohibitedKeys,
      normalizeUndefinedInQuery: normalizeUndefinedInQuery,
    }, options));
};

/**
 * Sanitize the data object
 */
ModelUtils._sanitizeData = function(data, options) {
  options = options || {};
  return sanitizeQueryOrData(data,
    Object.assign({
      maxDepth: this._getMaxDepthOfData(options),
    }, options));
};

/*
 * Coerce values based the property types
 * @param {Object} where The where clause
 * @options {Object} [options] Optional options to use.
 * @property {Boolean} allowExtendedOperators.
 * @returns {Object} The coerced where clause
 * @private
 */
ModelUtils._coerce = function(where, options) {
  var self = this;
  if (where == null) {
    return where;
  }
  options = options || {};

  var err;
  if (typeof where !== 'object' || Array.isArray(where)) {
    err = new Error(g.f('The where clause %j is not an {{object}}', where));
    err.statusCode = 400;
    throw err;
  }

  var props = self.definition.properties;
  for (var p in where) {
    // Handle logical operators
    if (p === 'and' || p === 'or' || p === 'nor') {
      var clauses = where[p];
      try {
        clauses = coerceArray(clauses);
      } catch (e) {
        err = new Error(g.f('The %s operator has invalid clauses %j: %s', p, clauses, e.message));
        err.statusCode = 400;
        throw err;
      }

      for (var k = 0; k < clauses.length; k++) {
        self._coerce(clauses[k], options);
      }

      continue;
    }
    var DataType = props[p] && props[p].type;
    if (!DataType) {
      continue;
    }
    if (Array.isArray(DataType) || DataType === Array) {
      DataType = DataType[0];
    }
    if (DataType === Date) {
      DataType = DateType;
    } else if (DataType === Boolean) {
      DataType = BooleanType;
    } else if (DataType === Number) {
      // This fixes a regression in mongodb connector
      // For numbers, only convert it produces a valid number
      // LoopBack by default injects a number id. We should fix it based
      // on the connector's input, for example, MongoDB should use string
      // while RDBs typically use number
      DataType = NumberType;
    }

    if (!DataType) {
      continue;
    }

    if (DataType.prototype instanceof BaseModel) {
      continue;
    }

    if (DataType === geo.GeoPoint) {
      // Skip the GeoPoint as the near operator breaks the assumption that
      // an operation has only one property
      // We should probably fix it based on
      // http://docs.mongodb.org/manual/reference/operator/query/near/
      // The other option is to make operators start with $
      continue;
    }

    var val = where[p];
    if (val === null || val === undefined) {
      continue;
    }
    // Check there is an operator
    var operator = null;
    var exp = val;
    if (val.constructor === Object) {
      for (var op in operators) {
        if (op in val) {
          val = val[op];
          operator = op;
          switch (operator) {
            case 'inq':
            case 'nin':
            case 'between':
              try {
                val = coerceArray(val);
              } catch (e) {
                err = new Error(g.f('The %s property has invalid clause %j: %s', p, where[p], e));
                err.statusCode = 400;
                throw err;
              }

              if (operator === 'between' && val.length !== 2) {
                err = new Error(g.f(
                  'The %s property has invalid clause %j: Expected precisely 2 values, received %d',
                  p,
                  where[p],
                  val.length
                ));
                err.statusCode = 400;
                throw err;
              }
              break;
            case 'like':
            case 'nlike':
            case 'ilike':
            case 'nilike':
              if (!(typeof val === 'string' || val instanceof RegExp)) {
                err = new Error(g.f(
                  'The %s property has invalid clause %j: Expected a string or RegExp',
                  p,
                  where[p]
                ));
                err.statusCode = 400;
                throw err;
              }
              break;
            case 'regexp':
              val = utils.toRegExp(val);
              if (val instanceof Error) {
                val.statusCode = 400;
                throw val;
              }
              break;
          }
          break;
        }
      }
    }

    try {
      // Coerce val into an array if it resembles an array-like object
      val = coerceArray(val);
    } catch (e) {
      // NOOP when not coercable into an array.
    }

    var allowExtendedOperators = self._allowExtendedOperators(options);
    // Coerce the array items
    if (Array.isArray(val)) {
      for (var i = 0; i < val.length; i++) {
        if (val[i] !== null && val[i] !== undefined) {
          if (!(val[i] instanceof RegExp)) {
            val[i] = DataType(val[i]);
          }
        }
      }
    } else {
      if (val != null) {
        if (operator === null && val instanceof RegExp) {
          // Normalize {name: /A/} to {name: {regexp: /A/}}
          operator = 'regexp';
        } else if (operator === 'regexp' && val instanceof RegExp) {
          // Do not coerce regex literals/objects
        } else if ((operator === 'like' || operator === 'nlike' ||
            operator === 'ilike' || operator === 'nilike') && val instanceof RegExp) {
          // Do not coerce RegExp operator value
        } else if (allowExtendedOperators && typeof val === 'object') {
          // Do not coerce object values when extended operators are allowed
        } else {
          if (!allowExtendedOperators) {
            var extendedOperators = Object.keys(val).filter(function(k) {
              return k[0] === '$';
            });
            if (extendedOperators.length) {
              const msg = g.f('Operators "' + extendedOperators.join(', ') + '" are not allowed in query');
              const err = new Error(msg);
              err.code = 'OPERATOR_NOT_ALLOWED_IN_QUERY';
              err.statusCode = 400;
              err.details = {
                operators: extendedOperators,
                where: where,
              };
              throw err;
            }
          }
          val = DataType(val);
        }
      }
    }
    // Rebuild {property: {operator: value}}
    if (operator && operator !== 'eq') {
      var value = {};
      value[operator] = val;
      if (exp.options) {
        // Keep options for operators
        value.options = exp.options;
      }
      val = value;
    }
    where[p] = val;
  }
  return where;
};

