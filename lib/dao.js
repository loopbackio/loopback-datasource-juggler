
/*!
 * Module exports class Model
 */
module.exports = DataAccessObject;

/*!
 * Module dependencies
 */
var jutil = require('./jutil');
var validations = require('./validations.js');
var ValidationError = validations.ValidationError;
var Relation = require('./relations.js');
var Inclusion = require('./include.js');
var List = require('./list.js');
var geo = require('./geo');
var Memory = require('./connectors/memory').Memory;
var utils = require('./utils');
var fieldsToArray = utils.fieldsToArray;
var removeUndefined = utils.removeUndefined;
var util = require('util');

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
  return m.getDataSource().idName
    ? m.getDataSource().idName(m.modelName) : 'id';
}

function getIdValue(m, data) {
  return data && data[m.getDataSource().idName(m.modelName)];
}

function setIdValue(m, data, value) {
  if (data) {
    data[idName(m)] = value;
  }
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
  var modelName = Model.modelName;

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
        if(!gotError) instances.forEach(Model.emit.bind('changed'));
      }
    }
  }

  var obj;
  // if we come from save
  if (data instanceof Model && !getIdValue(this, data)) {
    obj = data;
  } else {
    obj = new Model(data);
  }
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
        this._adapter().create(modelName, this.constructor._forDB(obj.toObject(true)), function (err, id, rev) {
          if (id) {
            obj.__data[_idName] = id;
            obj.__dataWas[_idName] = id;
            defineReadonlyProp(obj, _idName, id);
          }
          if (rev) {
            obj._rev = rev;
          }
          if (err) {
            return callback(err, obj);
          }
          saveDone.call(obj, function () {
            createDone.call(obj, function () {
              callback(err, obj);
              if(!err) Model.emit('changed', obj);
            });
          });
        }, obj);
      }, obj);
    }, obj);
  }

  // for chaining
  return obj;
};

/*!
 * Configure the remoting attributes for a given function
 * @param {Function} fn The function
 * @param {Object} options The options
 * @private
 */
function setRemoting(fn, options) {
  options = options || {};
  for (var opt in options) {
    if (options.hasOwnProperty(opt)) {
      fn[opt] = options[opt];
    }
  }
  fn.shared = true;
}

setRemoting(DataAccessObject.create, {
  description: 'Create a new instance of the model and persist it into the data source',
  accepts: {arg: 'data', type: 'object', description: 'Model instance data', http: {source: 'body'}},
  returns: {arg: 'data', type: 'object', root: true},
  http: {verb: 'post', path: '/'}
});

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
DataAccessObject.upsert = DataAccessObject.updateOrCreate = function upsert(data, callback) {
  if (stillConnecting(this.getDataSource(), this, arguments)) {
    return;
  }

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
    update = removeUndefined(update);
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
        var obj = new Model(data);
        obj.save(data, callback);
      }
    });
  }
};

// upsert ~ remoting attributes
setRemoting(DataAccessObject.upsert, {
  description: 'Update an existing model instance or insert a new one into the data source',
  accepts: {arg: 'data', type: 'object', description: 'Model instance data', http: {source: 'body'}},
  returns: {arg: 'data', type: 'object', root: true},
  http: {verb: 'put', path: '/'}
});

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
    this.dataSource.connector.exists(this.modelName, id, cb);
  } else {
    cb(new Error('Model::exists requires the id argument'));
  }
};

// exists ~ remoting attributes
setRemoting(DataAccessObject.exists, {
  description: 'Check whether a model instance exists in the data source',
  accepts: {arg: 'id', type: 'any', description: 'Model id', required: true,
            http: {source: 'path'}},
  returns: {arg: 'exists', type: 'any'},
  http: {verb: 'get', path: '/:id/exists'}
});

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

  this.getDataSource().connector.find(this.modelName, id, function (err, data) {
    var obj = null;
    if (data) {
      if (!getIdValue(this, data)) {
        setIdValue(this, data, id);
      }
      obj = new this();
      obj._initProperties(data);
    }
    cb(err, obj);
  }.bind(this));
};

// find ~ remoting attributes
setRemoting(DataAccessObject.findById, {
  description: 'Find a model instance by id from the data source',
  accepts: {arg: 'id', type: 'any', description: 'Model id', required: true,
            http: {source: 'path'}},
  returns: {arg: 'data', type: 'any', root: true},
  http: {verb: 'get', path: '/:id'},
  rest: {after: convertNullToNotFoundError}
});

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
    delete filter.skip;
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
        for (var i = 0; i < clauses.length; i++) {
          self._coerce(clauses[i]);
        }
      } else {
        err = new Error(util.format('The %p operator has invalid clauses %j', p, clauses));
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
      var OrigDate = Date;
      DataType = function Date(arg) {
        return new OrigDate(arg);
      };
    } else if (DataType === Boolean) {
      DataType = function (val) {
        if (val === 'true') {
          return true;
        } else if (val === 'false') {
          return false;
        } else {
          return Boolean(val);
        }
      };
    } else if (DataType === Number) {
      // This fixes a regression in mongodb connector
      // For numbers, only convert it produces a valid number
      // LoopBack by default injects a number id. We should fix it based
      // on the connector's input, for example, MongoDB should use string
      // while RDBs typically use number
      DataType = function (val) {
        var num = Number(val);
        return !isNaN(num) ? num : val;
      };
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
          break;
        }
      }
    }
    // Coerce the array items
    if (Array.isArray(val)) {
      for (var i = 0; i < val.length; i++) {
        val[i] = DataType(val[i]);
      }
    } else {
      val = DataType(val);
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

  var near = query && geo.nearFilter(query.where);
  var supportsGeo = !!this.getDataSource().connector.buildNearFilter;

  if (near) {
    if (supportsGeo) {
      // convert it
      this.getDataSource().connector.buildNearFilter(query, near);
    } else if (query.where) {
      // do in memory query
      // using all documents
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
        var obj = new self();

        obj._initProperties(d, {fields: query.fields});

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
            var includes = query.include || [];
            if (typeof includes === 'string') {
              includes = [includes];
            } else if (!Array.isArray(includes) && typeof includes === 'object') {
              includes = Object.keys(includes);
            }
            includes.forEach(function (inc) {
              // Promote the included model as a direct property
              var data = obj.__cachedRelations[inc];
              if(Array.isArray(data)) {
                data = new List(data, null, obj);
              }
              obj.__data[inc] = data;
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

// all ~ remoting attributes
setRemoting(DataAccessObject.find, {
  description: 'Find all instances of the model matched by filter from the data source',
  accepts: {arg: 'filter', type: 'object', description: 'Filter defining fields, where, orderBy, offset, and limit'},
  returns: {arg: 'data', type: 'array', root: true},
  http: {verb: 'get', path: '/'}
});

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

setRemoting(DataAccessObject.findOne, {
  description: 'Find first instance of the model matched by filter from the data source',
  accepts: {arg: 'filter', type: 'object', description: 'Filter defining fields, where, orderBy, offset, and limit'},
  returns: {arg: 'data', type: 'object', root: true},
  http: {verb: 'get', path: '/findOne'}
});

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
      if (!where) {
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

DataAccessObject.removeById = DataAccessObject.deleteById = DataAccessObject.destroyById = function deleteById(id, cb) {
      if (stillConnecting(this.getDataSource(), this, arguments)) return;
      var Model = this;

      this.getDataSource().connector.destroy(this.modelName, id, function (err) {
        if ('function' === typeof cb) {
          cb(err);
        }
        if(!err) Model.emit('deleted', id);
      }.bind(this));
    };

// deleteById ~ remoting attributes
setRemoting(DataAccessObject.deleteById, {
  description: 'Delete a model instance by id from the data source',
  accepts: {arg: 'id', type: 'any', description: 'Model id', required: true,
            http: {source: 'path'}},
  http: {verb: 'del', path: '/:id'}
});

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

// count ~ remoting attributes
setRemoting(DataAccessObject.count, {
  description: 'Count instances of the model matched by where from the data source',
  accepts: {arg: 'where', type: 'object', description: 'Criteria to match model instances'},
  returns: {arg: 'count', type: 'number'},
  http: {verb: 'get', path: '/count'}
});

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

  if (!getIdValue(Model, this)) {
    return Model.create(this, callback);
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
          inst._initProperties(data);
          updateDone.call(inst, function () {
            saveDone.call(inst, function () {
              callback(err, inst);
              if(!err) {
                Model.emit('changed', inst);
              }
            });
          });
        });
      }, data);
    }, data);
  }
};

DataAccessObject.prototype.isNewRecord = function () {
  return !getIdValue(this.constructor, this);
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
      });
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
 * Update saet of attributes.
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
  for (var key in data) {
    inst[key] = data[key];
  }

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
          }

          inst._adapter().updateAttributes(model, getIdValue(inst.constructor, inst), inst.constructor._forDB(typedData), function (err) {
            if (!err) {
              // update $was attrs
              for (var key in data) {
                inst.__dataWas[key] = inst.__data[key];
              }
            }
            done.call(inst, function () {
              saveDone.call(inst, function () {
                if(cb) cb(err, inst);
                if(!err) Model.emit('changed', inst);
              });
            });
          });
        }, data);
      }, data);
    }
  }, data);
};

// updateAttributes ~ remoting attributes
setRemoting(DataAccessObject.prototype.updateAttributes, {
  description: 'Update attributes for a model instance and persist it into the data source',
  accepts: {arg: 'data', type: 'object', http: {source: 'body'}, description: 'An object of model property name/value pairs'},
  returns: {arg: 'data', type: 'object', root: true},
  http: {verb: 'put', path: '/'}
});

/*
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
DataAccessObject.scope = function (name, query, targetClass) {
  defineScope(this, targetClass || this, name, query);
};

/*
 * Add 'include'
 */
jutil.mixin(DataAccessObject, Inclusion);

/*
 * Add 'relation'
 */
jutil.mixin(DataAccessObject, Relation);
