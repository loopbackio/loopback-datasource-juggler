
/*!
 * Module exports class Model
 */
module.exports = DataAccessObject;

/*!
 * Module dependencies
 */
var jutil = require('./jutil');
var ValidationError = require('./validations').ValidationError;
var Relation = require('./relations.js');
var Inclusion = require('./include.js');
var List = require('./list.js');
var geo = require('./geo');
var Memory = require('./connectors/memory').Memory;
var utils = require('./utils');
var fieldsToArray = utils.fieldsToArray;
var removeUndefined = utils.removeUndefined;
var setScopeValuesFromWhere = utils.setScopeValuesFromWhere;
var mergeQuery = utils.mergeQuery;
var util = require('util');
var assert = require('assert');

/**
 * Base class for all persistent objects.
 * Provides a common API to access any database connector.
 * This class describes only abstract behavior.  Refer to the specific connector for additional details.
 *
 * `DataAccessObject` mixes `Inclusion` classes methods.
 * @class DataAccessObject
 */
function DataAccessObject() {
  if (DataAccessObject._mixins) {
    var self = this;
    var args = arguments;
    DataAccessObject._mixins.forEach(function (m) {
      m.call(self, args);
    });
  }
}

function idName(m) {
  return m.definition.idName() || 'id';
}

function getIdValue(m, data) {
  return data && data[idName(m)];
}

function setIdValue(m, data, value) {
  if (data) {
    data[idName(m)] = value;
  }
}

function byIdQuery(m, id) {
  var pk = idName(m);
  var query = { where: {} };
  query.where[pk] = id;
  m.applyScope(query);
  return query;
}

DataAccessObject._forDB = function (data) {
  if (!(this.getDataSource().isRelational && this.getDataSource().isRelational())) {
    return data;
  }
  var res = {};
  for (var propName in data) {
    var type = this.getPropertyType(propName);
    if (type === 'JSON' || type === 'Any' || type === 'Object' || data[propName] instanceof Array) {
      res[propName] = JSON.stringify(data[propName]);
    } else {
      res[propName] = data[propName];
    }
  }
  return res;
};

DataAccessObject.defaultScope = function(target, inst) {
  var scope = this.definition.settings.scope;
  if (typeof scope === 'function') {
    scope = this.definition.settings.scope.call(this, target, inst);
  }
  return scope;
};

DataAccessObject.applyScope = function(query, inst) {
  var scope = this.defaultScope(query, inst) || {};
  if (typeof scope === 'object') {
    mergeQuery(query, scope || {}, this.definition.settings.scoping);
  }
};

DataAccessObject.applyProperties = function(data, inst) {
  var properties = this.definition.settings.properties;
  properties = properties || this.definition.settings.attributes;
  if (typeof properties === 'object') {
    util._extend(data, properties);
  } else if (typeof properties === 'function') {
    util._extend(data, properties.call(this, data, inst) || {});
  } else if (properties !== false) {
    var scope = this.defaultScope(data, inst) || {};
    if (typeof scope.where === 'object') {
      setScopeValuesFromWhere(data, scope.where, this);
    }
  }
};

DataAccessObject.lookupModel = function(data) {
  return this;
};

/**
 * Create an instance of Model with given data and save to the attached data source. Callback is optional.
 * Example:
 *```js
 * User.create({first: 'Joe', last: 'Bob'}, function(err, user) {
 *  console.log(user instanceof User); // true
 * });
 * ```
 * Note: You must include a callback and use the created model provided in the callback if your code depends on your model being
 * saved or having an ID.
 *
 * @param {Object} data  Optional data object
 * @param {Function} callback  Callback function called with these arguments:
 *   - err (null or Error)
 *   - instance (null or Model)
 */
DataAccessObject.create = function (data, callback) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  var Model = this;
  var self = this;
  
  if (typeof data === 'function') {
    callback = data;
    data = {};
  }

  if (typeof callback !== 'function') {
    callback = function () {
    };
  }

  if (!data) {
    data = {};
  }

  if (Array.isArray(data)) {
    var instances = [];
    var errors = Array(data.length);
    var gotError = false;
    var wait = data.length;
    if (wait === 0) {
      callback(null, []);
    }

    for (var i = 0; i < data.length; i += 1) {
      (function (d, i) {
        Model = self.lookupModel(d); // data-specific
        instances.push(Model.create(d, function (err, inst) {
          if (err) {
            errors[i] = err;
            gotError = true;
          }
          modelCreated();
        }));
      })(data[i], i);
    }

    return instances;

    function modelCreated() {
      if (--wait === 0) {
        callback(gotError ? errors : null, instances);
        if(!gotError) {
          instances.forEach(function(inst) {
            inst.constructor.emit('changed');
          });
        }
      }
    }
  }
  
  var enforced = {};
  var obj;
  var idValue = getIdValue(this, data);
  
  // if we come from save
  if (data instanceof Model && !idValue) {
    obj = data;
  } else {
    obj = new Model(data);
  }
  
  this.applyProperties(enforced, obj);
  obj.setAttributes(enforced);
  
  Model = this.lookupModel(data); // data-specific
  if (Model !== obj.constructor) obj = new Model(data);
  
  data = obj.toObject(true);
  
  // validation required
  obj.isValid(function (valid) {
    if (valid) {
      create();
    } else {
      callback(new ValidationError(obj), obj);
    }
  }, data);
  
  function create() {
    obj.trigger('create', function (createDone) {
      obj.trigger('save', function (saveDone) {

        var _idName = idName(Model);
        var modelName = Model.modelName;
        this._adapter().create(modelName, this.constructor._forDB(obj.toObject(true)), function (err, id, rev) {
          if (id) {
            obj.__data[_idName] = id;
            defineReadonlyProp(obj, _idName, id);
          }
          if (rev) {
            obj._rev = rev;
          }
          if (err) {
            return callback(err, obj);
          }
          obj.__persisted = true;
          saveDone.call(obj, function () {
            createDone.call(obj, function () {
              callback(err, obj);
              if(!err) Model.emit('changed', obj);
            });
          });
        }, obj);
      }, obj, callback);
    }, obj, callback);
  }

  // for chaining
  return obj;
};

function stillConnecting(dataSource, obj, args) {
  return dataSource.ready(obj, args);
}

/**
 * Update or insert a model instance: update exiting record if one is found, such that parameter `data.id` matches `id` of model instance;
 * otherwise, insert a new record.
 *
 * NOTE: No setters, validations, or hooks are applied when using upsert.
 * `updateOrCreate` is an alias
 * @param {Object} data The model instance data
 * @param {Function} callback The callback function (optional).
 */
// [FIXME] rfeng: This is a hack to set up 'upsert' first so that
// 'upsert' will be used as the name for strong-remoting to keep it backward
// compatible for angular SDK
DataAccessObject.updateOrCreate = DataAccessObject.upsert = function upsert(data, callback) {
  if (stillConnecting(this.getDataSource(), this, arguments)) {
    return;
  }
  var self = this;
  var Model = this;
  if (!getIdValue(this, data)) {
    return this.create(data, callback);
  }
  if (this.getDataSource().connector.updateOrCreate) {
    var update = data;
    var inst = data;
    if(!(data instanceof Model)) {
      inst = new Model(data);
    }
    update = inst.toObject(false);
    this.applyProperties(update, inst);
    update = removeUndefined(update);
    Model = this.lookupModel(update);
    this.getDataSource().connector.updateOrCreate(Model.modelName, update, function (err, data) {
      var obj;
      if (data && !(data instanceof Model)) {
        inst._initProperties(data);
        obj = inst;
      } else {
        obj = data;
      }
      callback(err, obj);
      if(!err) {
        Model.emit('changed', inst);
      }
    });
  } else {
    this.findById(getIdValue(this, data), function (err, inst) {
      if (err) {
        return callback(err);
      }
      if (inst) {
        inst.updateAttributes(data, callback);
      } else {
        Model = self.lookupModel(data);
        var obj = new Model(data);
        obj.save(data, callback);
      }
    });
  }
};

/**
 * Find one record that matches specified query criteria.  Same as `find`, but limited to one record, and this function returns an
 * object, not a collection.
 * If the specified instance is not found, then create it using data provided as second argument.
 *
 * @param {Object} query Search conditions. See [find](#dataaccessobjectfindquery-callback) for query format.
 * For example: `{where: {test: 'me'}}`.
 * @param {Object} data Object to create.
 * @param {Function} cb Callback called with (err, instance)
 */
DataAccessObject.findOrCreate = function findOrCreate(query, data, callback) {
  if (query === undefined) {
    query = {where: {}};
  }
  if (typeof data === 'function' || typeof data === 'undefined') {
    callback = data;
    data = query && query.where;
  }
  if (typeof callback === 'undefined') {
    callback = function () {
    };
  }

  var t = this;
  this.findOne(query, function (err, record) {
    if (err) return callback(err);
    if (record) return callback(null, record);
    t.create(data, callback);
  });
};

/**
 * Check whether a model instance exists in database
 *
 * @param {id} id Identifier of object (primary key value)
 * @param {Function} cb Callback function called with (err, exists: Bool)
 */
DataAccessObject.exists = function exists(id, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  if (id !== undefined && id !== null && id !== '') {
    this.count(byIdQuery(this, id).where, function(err, count) {
      cb(err, err ? false : count === 1);
    });
  } else {
    cb(new Error('Model::exists requires the id argument'));
  }
};

/**
 * Find model instance by ID.
 *
 * Example:
 * ```js
 * User.findById(23, function(err, user) {
 *   console.info(user.id); // 23
 * });
 * ```
 *
 * @param {*} id Primary key value
 * @param {Function} cb Callback called with (err, instance)
 */
DataAccessObject.findById = function find(id, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;
  this.findOne(byIdQuery(this, id), cb);
};

DataAccessObject.findByIds = function(ids, cond, cb) {
  if (typeof cond === 'function') {
    cb = cond;
    cond = {};
  }
  
  var pk = idName(this);
  if (ids.length === 0) {
    process.nextTick(function() { cb(null, []); });
    return;
  }
  
  var filter = { where: {} };
  filter.where[pk] = { inq: [].concat(ids) };
  mergeQuery(filter, cond || {});
  this.find(filter, function(err, results) {
    cb(err, err ? results : utils.sortObjectsByIds(pk, ids, results));
  }.bind(this));
};

function convertNullToNotFoundError(ctx, cb) {
  if (ctx.result !== null) return cb();

  var modelName = ctx.method.sharedClass.name;
  var id = ctx.getArgByName('id');
  var msg = 'Unknown "' + modelName + '" id "' + id + '".';
  var error = new Error(msg);
  error.statusCode = error.status = 404;
  cb(error);
}

// alias function for backwards compat.
DataAccessObject.all = function () {
  DataAccessObject.find.apply(this, arguments);
};

var operators = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  between: 'BETWEEN',
  inq: 'IN',
  nin: 'NOT IN',
  neq: '!=',
  like: 'LIKE',
  nlike: 'NOT LIKE'
};

/*
 * Normalize the filter object and throw errors if invalid values are detected
 * @param {Object} filter The query filter object
 * @returns {Object} The normalized filter object
 * @private
 */
DataAccessObject._normalize = function (filter) {
  if (!filter) {
    return undefined;
  }
  var err = null;
  if ((typeof filter !== 'object') || Array.isArray(filter)) {
    err = new Error(util.format('The query filter %j is not an object', filter));
    err.statusCode = 400;
    throw err;
  }
  if (filter.limit || filter.skip || filter.offset) {
    var limit = Number(filter.limit || 100);
    var offset = Number(filter.skip || filter.offset || 0);
    if (isNaN(limit) || limit <= 0 || Math.ceil(limit) !== limit) {
      err = new Error(util.format('The limit parameter %j is not valid',
        filter.limit));
      err.statusCode = 400;
      throw err;
    }
    if (isNaN(offset) || offset < 0 || Math.ceil(offset) !== offset) {
      err = new Error(util.format('The offset/skip parameter %j is not valid',
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
              err = new Error(util.format('The order %j has invalid direction', token));
              err.statusCode = 400;
              throw err;
            }
          }
          fields.push(token);
        }
      } else {
        err = new Error(util.format('The order %j is not valid', order[i]));
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
      Object.keys(this.definition.properties));
  }

  filter = removeUndefined(filter);
  this._coerce(filter.where);
  return filter;
};

function DateType(arg) {
  return new Date(arg);
}

function BooleanType(val) {
  if (val === 'true') {
    return true;
  } else if (val === 'false') {
    return false;
  } else {
    return Boolean(val);
  }
}

function NumberType(val) {
  var num = Number(val);
  return !isNaN(num) ? num : val;
}

/*
 * Coerce values based the property types
 * @param {Object} where The where clause
 * @returns {Object} The coerced where clause
 * @private
 */
DataAccessObject._coerce = function (where) {
  var self = this;
  if (!where) {
    return where;
  }

  var err;
  if (typeof where !== 'object' || Array.isArray(where)) {
    err = new Error(util.format('The where clause %j is not an object', where));
    err.statusCode = 400;
    throw err;
  }

  var props = self.definition.properties;
  for (var p in where) {
    // Handle logical operators
    if (p === 'and' || p === 'or' || p === 'nor') {
      var clauses = where[p];
      if (Array.isArray(clauses)) {
        for (var k = 0; k < clauses.length; k++) {
          self._coerce(clauses[k]);
        }
      } else {
        err = new Error(util.format('The %s operator has invalid clauses %j', p, clauses));
        err.statusCode = 400;
        throw err;
      }
      return where;
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
    if ('object' === typeof val) {
      if (Object.keys(val).length !== 1) {
        // Skip if there are not only one properties
        // as the assumption for operators is not true here
        continue;
      }
      for (var op in operators) {
        if (op in val) {
          val = val[op];
          operator = op;
          switch(operator) {
            case 'inq':
            case 'nin':
              if (!Array.isArray(val)) {
                err = new Error(util.format('The %s property has invalid clause %j', p, where[p]));
                err.statusCode = 400;
                throw err;
              }
              break;
            case 'between':
              if (!Array.isArray(val) || val.length !== 2) {
                err = new Error(util.format('The %s property has invalid clause %j', p, where[p]));
                err.statusCode = 400;
                throw err;
              }
              break;
            case 'like':
            case 'nlike':
              if (!(typeof val === 'string' || val instanceof RegExp)) {
                err = new Error(util.format('The %s property has invalid clause %j', p, where[p]));
                err.statusCode = 400;
                throw err;
              }
              break;
          }
          break;
        }
      }
    }
    // Coerce the array items
    if (Array.isArray(val)) {
      for (var i = 0; i < val.length; i++) {
        if (val[i] !== null && val[i] !== undefined) {
          val[i] = DataType(val[i]);
        }
      }
    } else {
      if (val !== null && val !== undefined) {
        val = DataType(val);
      }
    }
    // Rebuild {property: {operator: value}}
    if (operator) {
      var value = {};
      value[operator] = val;
      val = value;
    }
    where[p] = val;
  }
  return where;
};

/**
 * Find all instances of Model that match the specified query.
 * Fields used for filter and sort should be declared with `{index: true}` in model definition.
 * See [Querying models](http://docs.strongloop.com/display/DOC/Querying+models) for more information.
 *
 * For example, find the second page of ten users over age 21 in descending order exluding the password property.
 *
 * ```js
 * User.find({
 *   where: {
 *     age: {gt: 21}},
 *     order: 'age DESC',
 *     limit: 10,
 *     skip: 10,
 *     fields: {password: false}
 *   },
 *   console.log
 * );
 * ```
 *
 * @options {Object} [query] Optional JSON object that specifies query criteria and parameters.
 * @property {Object} where Search criteria in JSON format `{ key: val, key2: {gt: 'val2'}}`.
 * Operations:
 * - gt: >
 * - gte: >=
 * - lt: <
 * - lte: <=
 * - between
 * - inq: IN
 * - nin: NOT IN
 * - neq: !=
 * - like: LIKE
 * - nlike: NOT LIKE
 *
 * You can also use `and` and `or` operations.  See [Querying models](http://docs.strongloop.com/display/DOC/Querying+models) for more information.
 * @property {String|Object|Array} include Allows you to load relations of several objects and optimize numbers of requests.
 * Format examples;
 * - `'posts'`: Load posts
 * - `['posts', 'passports']`: Load posts and passports
 * - `{'owner': 'posts'}`: Load owner and owner's posts
 * - `{'owner': ['posts', 'passports']}`: Load owner, owner's posts, and owner's passports
 * - `{'owner': [{posts: 'images'}, 'passports']}`: Load owner, owner's posts, owner's posts' images, and owner's passports
 * See `DataAccessObject.include()`.
 * @property {String} order Sort order.  Format: `'key1 ASC, key2 DESC'`
 * @property {Number} limit Maximum number of instances to return.
 * @property {Number} skip Number of instances to skip.
 * @property {Number} offset Alias for `skip`.
 * @property {Object|Array|String} fields Included/excluded fields.
 * - `['foo']` or `'foo'` - include only the foo property
 *  - `['foo', 'bar']` - include the foo and bar properties.  Format:
 *  - `{foo: true}` - include only foo
 * - `{bat: false}` - include all properties, exclude bat
 *
 * @param {Function} callback Required callback function.  Call this function with two arguments: `err` (null or Error) and an array of instances.
 */

DataAccessObject.find = function find(query, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  if (arguments.length === 1) {
    cb = query;
    query = null;
  }
  var self = this;

  query = query || {};
  
  try {
    this._normalize(query);
  } catch (err) {
    return process.nextTick(function () {
      cb && cb(err);
    });
  }

  this.applyScope(query);
  
  var near = query && geo.nearFilter(query.where);
  var supportsGeo = !!this.getDataSource().connector.buildNearFilter;

  if (near) {
    if (supportsGeo) {
      // convert it
      this.getDataSource().connector.buildNearFilter(query, near);
    } else if (query.where) {
      // do in memory query
      // using all documents
      // TODO [fabien] use default scope here?
      this.getDataSource().connector.all(this.modelName, {}, function (err, data) {
        var memory = new Memory();
        var modelName = self.modelName;

        if (err) {
          cb(err);
        } else if (Array.isArray(data)) {
          memory.define({
            properties: self.dataSource.definitions[self.modelName].properties,
            settings: self.dataSource.definitions[self.modelName].settings,
            model: self
          });

          data.forEach(function (obj) {
            memory.create(modelName, obj, function () {
              // noop
            });
          });

          memory.all(modelName, query, cb);
        } else {
          cb(null, []);
        }
      }.bind(this));

      // already handled
      return;
    }
  }

  this.getDataSource().connector.all(this.modelName, query, function (err, data) {
    if (data && data.forEach) {
      data.forEach(function (d, i) {
        var Model = self.lookupModel(d);
        var obj = new Model(d, {fields: query.fields, applySetters: false, persisted: true});
        
        if (query && query.include) {
          if (query.collect) {
            // The collect property indicates that the query is to return the
            // standlone items for a related model, not as child of the parent object
            // For example, article.tags
            obj = obj.__cachedRelations[query.collect];
          } else {
            // This handles the case to return parent items including the related
            // models. For example, Article.find({include: 'tags'}, ...);
            // Try to normalize the include
            var includes = Inclusion.normalizeInclude(query.include || []);
            includes.forEach(function (inc) {
              var relationName = inc;
              if (utils.isPlainObject(inc)) {
                relationName = Object.keys(inc)[0];
              }
              
              // Promote the included model as a direct property
              var data = obj.__cachedRelations[relationName];
              if(Array.isArray(data)) {
                data = new List(data, null, obj);
              }
              if (data) obj.__data[relationName] = data;
            });
            delete obj.__data.__cachedRelations;
          }
        }
        data[i] = obj;
      });

      if (data && data.countBeforeLimit) {
        data.countBeforeLimit = data.countBeforeLimit;
      }
      if (!supportsGeo && near) {
        data = geo.filter(data, near);
      }

      cb(err, data);
    }
    else
      cb(err, []);
  });
};

/**
 * Find one record, same as `find`, but limited to one result. This function returns an object, not a collection.
 *
 * @param {Object} query Sarch conditions.  See [find](#dataaccessobjectfindquery-callback) for query format.
 * For example: `{where: {test: 'me'}}`.
 * @param {Function} cb Callback function called with (err, instance)
 */
DataAccessObject.findOne = function findOne(query, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  if (typeof query === 'function') {
    cb = query;
    query = {};
  }
  query = query || {};
  query.limit = 1;
  this.find(query, function (err, collection) {
    if (err || !collection || !collection.length > 0) return cb(err, null);
    cb(err, collection[0]);
  });
};

/**
 * Destroy all matching records.
 * Delete all model instances from data source. Note: destroyAll method does not destroy hooks.
 * Example:
 *````js
 * Product.destroyAll({price: {gt: 99}}, function(err) {
   // removed matching products
 * });
 * ````
 *
 * @param {Object} [where] Optional object that defines the criteria.  This is a "where" object. Do NOT pass a filter object.
 * @param {Function} [cb] Callback called with (err)
 */
DataAccessObject.remove = DataAccessObject.deleteAll = DataAccessObject.destroyAll = function destroyAll(where, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;
  var Model = this;

  if (!cb && 'function' === typeof where) {
    cb = where;
    where = undefined;
  }
  
  var query = { where: where };
  this.applyScope(query);
  where = query.where;
  
  if (!where || (typeof where === 'object' && Object.keys(where).length === 0)) {
    this.getDataSource().connector.destroyAll(this.modelName, function (err, data) {
      cb && cb(err, data);
      if(!err) Model.emit('deletedAll');
    }.bind(this));
  } else {
    try {
      // Support an optional where object
      where = removeUndefined(where);
      where = this._coerce(where);
    } catch (err) {
      return process.nextTick(function() {
        cb && cb(err);
      });
    }
    this.getDataSource().connector.destroyAll(this.modelName, where, function (err, data) {
      cb && cb(err, data);
      if(!err) Model.emit('deletedAll', where);
    }.bind(this));
  }
};

/**
 * Delete the record with the specified ID.
 * Aliases are `destroyById` and `deleteById`.
 * @param {*} id The id value
 * @param {Function} cb Callback called with (err)
 */

// [FIXME] rfeng: This is a hack to set up 'deleteById' first so that
// 'deleteById' will be used as the name for strong-remoting to keep it backward
// compatible for angular SDK
DataAccessObject.removeById = DataAccessObject.destroyById = DataAccessObject.deleteById = function deleteById(id, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;
  var Model = this;
  
  this.remove(byIdQuery(this, id).where, function(err) {
    if ('function' === typeof cb) {
      cb(err);
    }
    if(!err) Model.emit('deleted', id);
  });
};

/**
 * Return count of matched records. Optional query parameter allows you to count filtered set of model instances.
 * Example:
 *
 *```js
 * User.count({approved: true}, function(err, count) {
 *     console.log(count); // 2081
 * });
 * ```
 *
 * @param {Object} [where] Search conditions (optional)
 * @param {Function} cb Callback, called with (err, count)
 */
DataAccessObject.count = function (where, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  if (typeof where === 'function') {
    cb = where;
    where = null;
  }
  
  var query = { where: where };
  this.applyScope(query);
  where = query.where;
  
  try {
    where = removeUndefined(where);
    where = this._coerce(where);
  } catch (err) {
    return process.nextTick(function () {
      cb && cb(err);
    });
  }
  
  this.getDataSource().connector.count(this.modelName, cb, where);
};

/**
 * Save instance. If the instance does not have an ID, call `create` instead.
 * Triggers: validate, save, update or create.
 * @options {Object} options Optional options to use.
 * @property {Boolean} validate Default is true.
 * @property {Boolean} throws  Default is false.
 * @param {Function} callback Callback function with err and object arguments
 */
DataAccessObject.prototype.save = function (options, callback) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;
  var Model = this.constructor;

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  callback = callback || function () {
  };
  options = options || {};

  if (!('validate' in options)) {
    options.validate = true;
  }
  if (!('throws' in options)) {
    options.throws = false;
  }
  
  var inst = this;
  var data = inst.toObject(true);
  var modelName = Model.modelName;
  
  Model.applyProperties(data, this);
  
  if (this.isNewRecord()) {
    return Model.create(this, callback);
  } else {
    inst.setAttributes(data);
  }

  // validate first
  if (!options.validate) {
    return save();
  }

  inst.isValid(function (valid) {
    if (valid) {
      save();
    } else {
      var err = new ValidationError(inst);
      // throws option is dangerous for async usage
      if (options.throws) {
        throw err;
      }
      callback(err, inst);
    }
  });

  // then save
  function save() {
    inst.trigger('save', function (saveDone) {
      inst.trigger('update', function (updateDone) {
        data = removeUndefined(data);
        inst._adapter().save(modelName, inst.constructor._forDB(data), function (err) {
          if (err) {
            return callback(err, inst);
          }
          inst._initProperties(data, { persisted: true });
          updateDone.call(inst, function () {
            saveDone.call(inst, function () {
              callback(err, inst);
              if(!err) {
                Model.emit('changed', inst);
              }
            });
          });
        });
      }, data, callback);
    }, data, callback);
  }
};

/**
 * Update multiple instances that match the where clause
 *
 * Example:
 *
 *```js
 * Employee.update({managerId: 'x001'}, {managerId: 'x002'}, function(err) {
 *     ...
 * });
 * ```
 *
 * @param {Object} [where] Search conditions (optional)
 * @param {Object} data Changes to be made
 * @param {Function} cb Callback, called with (err, count)
 */
DataAccessObject.update =
DataAccessObject.updateAll = function (where, data, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  if (arguments.length === 1) {
    // update(data) is being called
    data = where;
    where = null;
    cb = null;
  } else if (arguments.length === 2) {
    if (typeof data === 'function') {
      // update(data, cb) is being called
      cb = data;
      data = where;
      where = null;
    } else {
      // update(where, data) is being called
      cb = null;
    }
  }

  assert(typeof where === 'object', 'The where argument should be an object');
  assert(typeof data === 'object', 'The data argument should be an object');
  assert(cb === null || typeof cb === 'function', 'The cb argument should be a function');
  
  var query = { where: where };
  this.applyScope(query);
  this.applyProperties(data);
  
  where = query.where;
  
  try {
    where = removeUndefined(where);
    where = this._coerce(where);
  } catch (err) {
    return process.nextTick(function () {
      cb && cb(err);
    });
  }
  
  var connector = this.getDataSource().connector;
  connector.update(this.modelName, where, data, cb);
};

DataAccessObject.prototype.isNewRecord = function () {
  return !this.__persisted;
};

/**
 * Return connector of current record
 * @private
 */
DataAccessObject.prototype._adapter = function () {
  return this.getDataSource().connector;
};

/**
 * Delete object from persistence
 *
 * Triggers `destroy` hook (async) before and after destroying object
 */
DataAccessObject.prototype.remove =
  DataAccessObject.prototype.delete =
    DataAccessObject.prototype.destroy = function (cb) {
      if (stillConnecting(this.getDataSource(), this, arguments)) return;
      var Model = this.constructor;
      var id = getIdValue(this.constructor, this);

      this.trigger('destroy', function (destroyed) {
        this._adapter().destroy(this.constructor.modelName, id, function (err) {
          if (err) {
            return cb(err);
          }

          destroyed(function () {
            if (cb) cb();
            Model.emit('deleted', id);
          });
        }.bind(this));
      }, null, cb);
    };
    
/**
 * Set a single attribute.
 * Equivalent to `setAttributes({name: value})`
 *
 * @param {String} name Name of property
 * @param {Mixed} value Value of property
 */
DataAccessObject.prototype.setAttribute = function setAttribute(name, value) {
  this[name] = value; // TODO [fabien] - currently not protected by applyProperties
};    

/**
 * Update a single attribute.
 * Equivalent to `updateAttributes({name: value}, cb)`
 *
 * @param {String} name Name of property
 * @param {Mixed} value Value of property
 * @param {Function} callback Callback function called with (err, instance)
 */
DataAccessObject.prototype.updateAttribute = function updateAttribute(name, value, callback) {
  var data = {};
  data[name] = value;
  this.updateAttributes(data, callback);
};

/**
 * Update set of attributes.
 *
 * @trigger `change` hook
 * @param {Object} data Data to update
 */
DataAccessObject.prototype.setAttributes = function setAttributes(data) {
  if (typeof data !== 'object') return;
  
  this.constructor.applyProperties(data, this);
  
  var Model = this.constructor;
  var inst = this;
  
  // update instance's properties
  for (var key in data) {
    inst.setAttribute(key, data[key]);
  }
  
  Model.emit('set', inst);
};

DataAccessObject.prototype.unsetAttribute = function unsetAttribute(name, nullify) {
  if (nullify) {
    this[name] = this.__data[name] = null;
  } else {
    delete this[name];
    delete this.__data[name];
  }
};

/**
 * Update set of attributes.
 * Performs validation before updating.
 *
 * @trigger `validation`, `save` and `update` hooks
 * @param {Object} data Data to update
 * @param {Function} callback Callback function called with (err, instance)
 */
DataAccessObject.prototype.updateAttributes = function updateAttributes(data, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  var inst = this;
  var Model = this.constructor;
  var model = Model.modelName;

  if (typeof data === 'function') {
    cb = data;
    data = null;
  }

  if (!data) {
    data = {};
  }

  // update instance's properties
  inst.setAttributes(data);

  inst.isValid(function (valid) {
    if (!valid) {
      if (cb) {
        cb(new ValidationError(inst), inst);
      }
    } else {
      inst.trigger('save', function (saveDone) {
        inst.trigger('update', function (done) {
          var typedData = {};

          for (var key in data) {
            // Convert the properties by type
            inst[key] = data[key];
            typedData[key] = inst[key];
            if (typeof typedData[key] === 'object' 
              && typedData[key] !== null
              && typeof typedData[key].toObject === 'function') {
              typedData[key] = typedData[key].toObject();
            }
          }

          inst._adapter().updateAttributes(model, getIdValue(inst.constructor, inst),
            inst.constructor._forDB(typedData), function (err) {
            if (!err) inst.__persisted = true;
            done.call(inst, function () {
              saveDone.call(inst, function () {
                if(cb) cb(err, inst);
                if(!err) Model.emit('changed', inst);
              });
            });
          });
        }, data, cb);
      }, data, cb);
    }
  }, data);
};

/**
 * Reload object from persistence
 * Requires `id` member of `object` to be able to call `find`
 * @param {Function} callback Called with (err, instance) arguments
 * @private
 */
DataAccessObject.prototype.reload = function reload(callback) {
  if (stillConnecting(this.getDataSource(), this, arguments)) {
    return;
  }

  this.constructor.findById(getIdValue(this.constructor, this), callback);
};


/*
 * Define readonly property on object
 *
 * @param {Object} obj
 * @param {String} key
 * @param {Mixed} value
 * @private
 */
function defineReadonlyProp(obj, key, value) {
  Object.defineProperty(obj, key, {
    writable: false,
    enumerable: true,
    configurable: true,
    value: value
  });
}

var defineScope = require('./scope.js').defineScope;

/**
 * Define a scope for the model class. Scopes enable you to specify commonly-used
 * queries that you can reference as method calls on a model.
 *
 * @param {String} name The scope name
 * @param {Object} query The query object for DataAccessObject.find()
 * @param {ModelClass} [targetClass] The model class for the query, default to
 * the declaring model
 */
DataAccessObject.scope = function (name, query, targetClass, methods, options) {
  var cls = this;
  if (options && options.isStatic === false) {
    cls = cls.prototype;
  }
  defineScope(cls, targetClass || cls, name, query, methods, options);
};

/*
 * Add 'include'
 */
jutil.mixin(DataAccessObject, Inclusion);

/*
 * Add 'relation'
 */
jutil.mixin(DataAccessObject, Relation);
