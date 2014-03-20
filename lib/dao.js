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

/**
 * Base class for all persistent objects.
 * Provides a common API to access any database connector.
 * This class describes only abstract behavior.  Refer to the specific connector (`lib/connectors/*.js`) for details.
 *
 * `DataAccessObject` mixes `Inclusion` classes methods.
 *
 * @class DataAccessObject
 * @param {Object} data Initial object data
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
 * Create new instance of Model class, saved in database.
 * The callback function is called with arguments:
 *
 *   - err (null or Error)
 *   - instance (null or Model)
 *
 * @param data {Object} Optional data object
 * @param callback {Function} Callback function 

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
    if (wait === 0) callback(null, []);

    var instances = [];
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
 * Update or insert a model instance.
 * @param {Object} data The model instance data
 * @param {Function} callback The callback function (optional).
 */
DataAccessObject.upsert = DataAccessObject.updateOrCreate = function upsert(data, callback) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  var Model = this;
  if (!getIdValue(this, data)) return this.create(data, callback);
  if (this.getDataSource().connector.updateOrCreate) {
    var inst = new Model(data);
    this.getDataSource().connector.updateOrCreate(Model.modelName, inst.toObject(true), function (err, data) {
      var obj;
      if (data) {
        inst._initProperties(data);
        obj = inst;
      } else {
        obj = null;
      }
      callback(err, obj);
    });
  } else {
    this.findById(getIdValue(this, data), function (err, inst) {
      if (err) return callback(err);
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
 * Find one record, same as `all`, limited by 1 and return object, not collection,
 * if not found, create using data provided as second argument
 *
 * @param {Object} query Search conditions: {where: {test: 'me'}}.
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
  accepts: {arg: 'id', type: 'any', description: 'Model id', required: true},
  returns: {arg: 'exists', type: 'any'},
  http: {verb: 'get', path: '/:id/exists'}
});

/**
 * Find object by id
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
  accepts: {arg: 'id', type: 'any', description: 'Model id', required: true},
  returns: {arg: 'data', type: 'any', root: true},
  http: {verb: 'get', path: '/:id'},
  rest: {after: convertNullToNotFoundError}
});

function convertNullToNotFoundError(ctx, cb) {
  if (ctx.result !== null) return cb();

  var modelName = ctx.method.sharedClass.name;
  var id = ctx.getArgByName('id');
  var msg = 'Unkown "' + modelName + '" id "' + id + '".';
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

DataAccessObject._coerce = function (where) {
  if (!where) {
    return where;
  }

  var props = this.getDataSource().getModelDefinition(this.modelName).properties;
  for (var p in where) {
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
 * Find all instances of Model, matched by query
 * make sure you have marked as `index: true` fields for filter or sort
 *
 * @param {Object} [query] the query object
 *
 * - where: Object `{ key: val, key2: {gt: 'val2'}}`
 * - include: String, Object or Array. See `DataAccessObject.include()`.
 * - order: String
 * - limit: Number
 * - skip: Number
 * 
 * @param {Object} params (optional)
 * @param {Function} callback (required) called with two arguments: err (null or Error), array of instances
 */

DataAccessObject.find = function find(query, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  if (arguments.length === 1) {
    cb = query;
    query = null;
  }
  var constr = this;

  query = query || {};

  if (query.where) {
    query.where = this._coerce(query.where);
  }

  var fields = query.fields;
  var near = query && geo.nearFilter(query.where);
  var supportsGeo = !!this.getDataSource().connector.buildNearFilter;

  // normalize fields as array of included property names
  if (fields) {
    query.fields = fieldsToArray(fields, Object.keys(this.definition.properties));
  }

  query = removeUndefined(query);
  if (near) {
    if (supportsGeo) {
      // convert it
      this.getDataSource().connector.buildNearFilter(query, near);
    } else if (query.where) {
      // do in memory query
      // using all documents
      this.getDataSource().connector.all(this.modelName, {}, function (err, data) {
        var memory = new Memory();
        var modelName = constr.modelName;

        if (err) {
          cb(err);
        } else if (Array.isArray(data)) {
          memory.define({
            properties: constr.dataSource.definitions[constr.modelName].properties,
            settings: constr.dataSource.definitions[constr.modelName].settings,
            model: constr
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
        var obj = new constr();

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
 * Find one record, same as `all`, limited by 1 and return object, not collection
 *
 * @param {Object} query - search conditions: {where: {test: 'me'}}
 * @param {Function} cb - callback called with (err, instance)
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
 * Destroy all matching records
 * @param {Object} [where] An object that defines the criteria
 * @param {Function} [cb] Callback called with (err)
 */
DataAccessObject.remove =
  DataAccessObject.deleteAll =
    DataAccessObject.destroyAll = function destroyAll(where, cb) {
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
        // Support an optional where object
        where = removeUndefined(where);
        where = this._coerce(where);
        this.getDataSource().connector.destroyAll(this.modelName, where, function (err, data) {
          cb && cb(err, data);
          if(!err) Model.emit('deletedAll', where);
        }.bind(this));
      }
    };

/**
 * Destroy a record by id
 * @param {*} id The id value
 * @param {Function} cb Callback called with (err)
 */
DataAccessObject.removeById =
  DataAccessObject.deleteById =
    DataAccessObject.destroyById = function deleteById(id, cb) {
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
  accepts: {arg: 'id', type: 'any', description: 'Model id', required: true},
  http: {verb: 'del', path: '/:id'}
});

/**
 * Return count of matched records
 *
 * @param {Object} where Search conditions (optional)
 * @param {Function} cb Callback, called with (err, count)
 */
DataAccessObject.count = function (where, cb) {
  if (stillConnecting(this.getDataSource(), this, arguments)) return;

  if (typeof where === 'function') {
    cb = where;
    where = null;
  }
  where = removeUndefined(where);
  where = this._coerce(where);
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
 * Save instance. When instance haven't id, create method called instead.
 * Triggers: validate, save, update | create
 * @param options {validate: true, throws: false} [optional]
 * @param callback(err, obj)
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
 * Update single attribute
 *
 * equals to `updateAttributes({name: value}, cb)
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
 * Update set of attributes
 *
 * this method performs validation before updating
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

/**
 * Reload object from persistence
 * Requires `id` member of `object` to be able to call `find`
 * @param {Function} callback Called with (err, instance) arguments
 */
DataAccessObject.prototype.reload = function reload(callback) {
  if (stillConnecting(this.getDataSource(), this, arguments)) {
    return;
  }

  this.constructor.findById(getIdValue(this.constructor, this), callback);
};


/*!
 * Define readonly property on object
 *
 * @param {Object} obj
 * @param {String} key
 * @param {Mixed} value
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

/*!
 * Add 'include'
 */
jutil.mixin(DataAccessObject, Inclusion);

/*!
 * Add 'relation'
 */
jutil.mixin(DataAccessObject, Relation);
