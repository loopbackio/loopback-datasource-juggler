/**
 * Module exports class Model
 */
module.exports = DataAccessObject;

/**
 * Module dependencies
 */
var util = require('util');
var jutil = require('./jutil');
var validations = require('./validations.js');
var ValidationError = validations.ValidationError;
var List = require('./list.js');
require('./relations.js');
var Inclusion = require('./include.js');
var Relation = require('./relations.js');
var geo = require('./geo');
var Memory = require('./adapters/memory').Memory;

/**
 * DAO class - base class for all persist objects
 * provides **common API** to access any database adapter.
 * This class describes only abstract behavior layer, refer to `lib/adapters/*.js`
 * to learn more about specific adapter implementations
 *
 * `DataAccessObject` mixes `Inclusion` classes methods
 *
 * @constructor
 * @param {Object} data - initial object data
 */
function DataAccessObject() {
    if(DataAccessObject._mixins) {
        var self = this;
        var args = arguments;
        DataAccessObject._mixins.forEach(function(m) {
            m.call(self, args);
        });
    }
}


DataAccessObject._forDB = function (data) {
    if(!(this.schema.isRelational && this.schema.isRelational())) {
        return data;
    }
    var res = {};
    Object.keys(data).forEach(function (propName) {
        if (this.whatTypeName(propName) === 'JSON' || data[propName] instanceof Array) {
            res[propName] = JSON.stringify(data[propName]);
        } else {
            res[propName] = data[propName];
        }
    }.bind(this));
    return res;
};


/**
 * Create new instance of Model class, saved in database
 *
 * @param data [optional]
 * @param callback(err, obj)
 * callback called with arguments:
 *
 *   - err (null or Error)
 *   - instance (null or Model)
 */
DataAccessObject.create = function (data, callback) {
    if (stillConnecting(this.schema, this, arguments)) return;

    var Model = this;
    var modelName = Model.modelName;

    if (typeof data === 'function') {
        callback = data;
        data = {};
    }

    if (typeof callback !== 'function') {
        callback = function () {};
    }

    if (!data) {
        data = {};
    }

    if (data instanceof Array) {
        var instances = [];
        var errors = Array(data.length);
        var gotError = false;
        var wait = data.length;
        if (wait === 0) callback(null, []);

        var instances = [];
        for (var i = 0; i < data.length; i += 1) {
            (function(d, i) {
                instances.push(Model.create(d, function(err, inst) {
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
            }
        }
    }


    var obj;
    // if we come from save
    if (data instanceof Model && !data.id) {
        obj = data;
    } else {
        obj = new Model(data);
    }
    data = obj.toObject(true);

    // validation required
    obj.isValid(function(valid) {
        if (valid) {
            create();
        } else {
            callback(new ValidationError(obj), obj);
        }
    }, data);

    function create() {
        obj.trigger('create', function(createDone) {
            obj.trigger('save', function(saveDone) {

                this._adapter().create(modelName, this.constructor._forDB(obj.toObject(true)), function (err, id, rev) {
                    if (id) {
                        obj.__data.id = id;
                        obj.__dataWas.id = id;
                        defineReadonlyProp(obj, 'id', id);
                    }
                    if (rev) {
                        obj._rev = rev
                    }
                    if (err) {
                        return callback(err, obj);
                    }
                    saveDone.call(obj, function () {
                        createDone.call(obj, function () {
                            callback(err, obj);
                        });
                    });
                }, obj);
            }, obj);
        }, obj);
    }

    // for chaining
    return obj;
};

DataAccessObject.create.shared = true;
DataAccessObject.create.accepts = {arg: 'data', type: 'object', http: {source: 'body'}};
DataAccessObject.create.returns = {arg: 'data', type: 'object'};
DataAccessObject.create.http = {verb: 'post', path: '/'};

function stillConnecting(schema, obj, args) {
    if (schema.connected) return false; // Connected

    var method = args.callee;
    // Set up a callback after the connection is established to continue the method call
    schema.once('connected', function () {
        method.apply(obj, [].slice.call(args));
    });
    if (!schema.connecting) {
        schema.connect();
    }
    return true;
};

/**
 * Update or insert
 */
DataAccessObject.upsert = DataAccessObject.updateOrCreate = function upsert(data, callback) {
    if (stillConnecting(this.schema, this, arguments)) return;

    var Model = this;
    if (!data.id) return this.create(data, callback);
    if (this.schema.adapter.updateOrCreate) {
        var inst = new Model(data);
        this.schema.adapter.updateOrCreate(Model.modelName, inst.toObject(true), function (err, data) {
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
        this.findById(data.id, function (err, inst) {
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

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection,
 * if not found, create using data provided as second argument
 * 
 * @param {Object} query - search conditions: {where: {test: 'me'}}.
 * @param {Object} data - object to create.
 * @param {Function} cb - callback called with (err, instance)
 */
DataAccessObject.findOrCreate = function findOrCreate(query, data, callback) {
    if (typeof query === 'undefined') {
        query = {where: {}};
    }
    if (typeof data === 'function' || typeof data === 'undefined') {
        callback = data;
        data = query && query.where;
    }
    if (typeof callback === 'undefined') {
        callback = function () {};
    }

    var t = this;
    this.findOne(query, function (err, record) {
        if (err) return callback(err);
        if (record) return callback(null, record);
        t.create(data, callback);
    });
};

/**
 * Check whether object exitst in database
 *
 * @param {id} id - identifier of object (primary key value)
 * @param {Function} cb - callbacl called with (err, exists: Bool)
 */
DataAccessObject.exists = function exists(id, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    if (id) {
        this.schema.adapter.exists(this.modelName, id, cb);
    } else {
        cb(new Error('Model::exists requires positive id argument'));
    }
};

// exists ~ remoting attributes
DataAccessObject.exists.shared = true;
DataAccessObject.exists.accepts = {arg: 'id', type: 'any'};

/**
 * Find object by id
 *
 * @param {id} id - primary key value
 * @param {Function} cb - callback called with (err, instance)
 */
DataAccessObject.findById = function find(id, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    this.schema.adapter.find(this.modelName, id, function (err, data) {
        var obj = null;
        if (data) {
            if (!data.id) {
                data.id = id;
            }
            obj = new this();
            obj._initProperties(data, false);
        }
        cb(err, obj);
    }.bind(this));
};

// find ~ remoting attributes
DataAccessObject.findById.accepts = [
  {arg: 'id', type: 'any'}
];
DataAccessObject.findById.shared = true;
DataAccessObject.findById.http = [
  {verb: 'get', path: '/:id'}
];

/**
 * Find all instances of Model, matched by query
 * make sure you have marked as `index: true` fields for filter or sort
 *
 * @param {Object} params (optional)
 *
 * - where: Object `{ key: val, key2: {gt: 'val2'}}`
 * - include: String, Object or Array. See DataAccessObject.include documentation.
 * - order: String
 * - limit: Number
 * - skip: Number
 *
 * @param {Function} callback (required) called with arguments:
 *
 * - err (null or Error)
 * - Array of instances
 */

DataAccessObject.all = 
DataAccessObject.find = function find(params, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    if (arguments.length === 1) {
        cb = params;
        params = null;
    }
    var constr = this;
    
    var near = params && geo.nearFilter(params.where);
    var supportsGeo = !!this.schema.adapter.buildNearFilter;
    
    if(near) {
      if(supportsGeo) {
        // convert it
        this.schema.adapter.buildNearFilter(params, near);
      } else if(params.where) {
        // do in memory query
        // using all documents
        
        
        
        
        this.schema.adapter.all(this.modelName, {}, function (err, data) {
          var memory = new Memory();
          var modelName = constr.modelName;
          
          if(err) {
            cb(err);
          } else if(Array.isArray(data)) {
            memory.define({
              properties: constr.schema.definitions[constr.modelName].properties,
              settings: constr.schema.definitions[constr.modelName].settings,
              model: constr
            });
            
            data.forEach(function (obj) {
              memory.create(modelName, obj, function () {
                // noop
              });
            });
            
            memory.all(modelName, params, cb);
          } else {
            cb(null, []);
          }
        }.bind(this));
        
        // already handled
        return;
      }
    }
    
    this.schema.adapter.all(this.modelName, params, function (err, data) {
        if (data && data.forEach) {
            data.forEach(function (d, i) {
                var obj = new constr;
                obj._initProperties(d, false);
                if (params && params.include && params.collect) {
                    data[i] = obj.__cachedRelations[params.collect];
                } else {
                    data[i] = obj;
                }
            });
            if (data && data.countBeforeLimit) {
                data.countBeforeLimit = data.countBeforeLimit;
            }
            if(!supportsGeo && near) {
              data = geo.filter(data, near);
            }
            
            cb(err, data);
        }
        else
            cb(err, []);
    });
};

// all ~ remoting attributes
DataAccessObject.find.accepts = {arg: 'filter', type: 'object'};
DataAccessObject.find.shared = true;
DataAccessObject.find.http = [
  {verb: 'get', path: '/'},
  {verb: 'get', path: '/all'}
];

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection
 * 
 * @param {Object} params - search conditions: {where: {test: 'me'}}
 * @param {Function} cb - callback called with (err, instance)
 */
DataAccessObject.findOne = function findOne(params, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    if (typeof params === 'function') {
        cb = params;
        params = {};
    }
    params.limit = 1;
    this.find(params, function (err, collection) {
        if (err || !collection || !collection.length > 0) return cb(err, null);
        cb(err, collection[0]);
    });
};

DataAccessObject.findOne.shared = true;
DataAccessObject.findOne.accepts = {arg: 'filter', type: 'object'};
DataAccessObject.findOne.returns = {arg: 'data', type: 'object'};

/**
 * Destroy all records
 * @param {Function} cb - callback called with (err)
 */
DataAccessObject.deleteAll =
DataAccessObject.destroyAll = function destroyAll(cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    this.schema.adapter.destroyAll(this.modelName, function (err) {
        if ('function' === typeof cb) {
            cb(err);
        }
    }.bind(this));
};

/**
 * Return count of matched records
 *
 * @param {Object} where - search conditions (optional)
 * @param {Function} cb - callback, called with (err, count)
 */
DataAccessObject.count = function (where, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    if (typeof where === 'function') {
        cb = where;
        where = null;
    }
    this.schema.adapter.count(this.modelName, cb, where);
};


// count ~ remoting attributes
DataAccessObject.count.shared = true;
DataAccessObject.count.accepts = [
  {arg: 'where', type: 'object'}
];
DataAccessObject.count.http = {verb: 'get', path: '/count'};

/**
 * Save instance. When instance haven't id, create method called instead.
 * Triggers: validate, save, update | create
 * @param options {validate: true, throws: false} [optional]
 * @param callback(err, obj)
 */
DataAccessObject.prototype.save = function (options, callback) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    if (typeof options == 'function') {
        callback = options;
        options = {};
    }

    callback = callback || function () {};
    options = options || {};

    if (!('validate' in options)) {
        options.validate = true;
    }
    if (!('throws' in options)) {
        options.throws = false;
    }

    var inst = this;
    var data = inst.toObject(true);
    var Model = this.constructor;
    var modelName = Model.modelName;

    if (!this.id) {
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
                    inst._initProperties(data, false);
                    updateDone.call(inst, function () {
                        saveDone.call(inst, function () {
                            callback(err, inst);
                        });
                    });
                });
            }, data);
        }, data);
    }
};

// save ~ remoting attributes
DataAccessObject.prototype.save.shared = true;
DataAccessObject.prototype.save.returns = {arg: 'obj', type: 'object'};
DataAccessObject.prototype.save.http = [
  {verb: 'put', path: '/'}
];

DataAccessObject.prototype.isNewRecord = function () {
    return !this.id;
};

/**
 * Return adapter of current record
 * @private
 */
DataAccessObject.prototype._adapter = function () {
    return this.schema.adapter;
};

/**
 * Delete object from persistence
 *
 * @triggers `destroy` hook (async) before and after destroying object
 */
DataAccessObject.prototype.delete =
DataAccessObject.prototype.destroy = function (cb) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    this.trigger('destroy', function (destroyed) {
        this._adapter().destroy(this.constructor.modelName, this.id, function (err) {
            if (err) {
                return cb(err);
            }

            destroyed(function () {
                if(cb) cb();
            });
        }.bind(this));
    });
};

// destroy ~ remoting attributes
DataAccessObject.prototype.destroy.shared = true;
DataAccessObject.prototype.destroy.http = [
  {verb: 'del', path: '/'}
];

/**
 * Update single attribute
 *
 * equals to `updateAttributes({name: value}, cb)
 *
 * @param {String} name - name of property
 * @param {Mixed} value - value of property
 * @param {Function} callback - callback called with (err, instance)
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
 * @param {Object} data - data to update
 * @param {Function} callback - callback called with (err, instance)
 */
DataAccessObject.prototype.updateAttributes = function updateAttributes(data, cb) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    var inst = this;
    var model = this.constructor.modelName;

    if (typeof data === 'function') {
        cb = data;
        data = null;
    }

    if (!data) {
        data = {};
    }

    // update instance's properties
    Object.keys(data).forEach(function (key) {
        inst[key] = data[key];
    });

    inst.isValid(function (valid) {
        if (!valid) {
            if (cb) {
                cb(new ValidationError(inst), inst);
            }
        } else {
            inst.trigger('save', function (saveDone) {
                inst.trigger('update', function (done) {

                    Object.keys(data).forEach(function (key) {
                        inst[key] = data[key];
                    });

                    inst._adapter().updateAttributes(model, inst.id, inst.constructor._forDB(data), function (err) {
                        if (!err) {
                            // update _was attrs
                            Object.keys(data).forEach(function (key) {
                                inst.__dataWas[key] = inst.__data[key];
                            });
                        }
                        done.call(inst, function () {
                            saveDone.call(inst, function () {
                                cb(err, inst);
                            });
                        });
                    });
                }, data);
            }, data);
        }
    }, data);
};

// updateAttributes ~ remoting attributes
DataAccessObject.prototype.updateAttributes.shared = true;
DataAccessObject.prototype.updateAttributes.accepts = {arg: 'data', type: 'object', http: {source: 'body'}};
DataAccessObject.prototype.updateAttributes.http = [
  {verb: 'put', path: '/'}
];

/**
 * Reload object from persistence
 *
 * @requires `id` member of `object` to be able to call `find`
 * @param {Function} callback - called with (err, instance) arguments
 */
DataAccessObject.prototype.reload = function reload(callback) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    this.constructor.findById(this.id, callback);
};

DataAccessObject.prototype.reload.shared = true;
DataAccessObject.prototype.reload.returns = {arg: 'data', type: 'object'};

/**
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

// jutil.mixin(DataAccessObject, validations.Validatable);
jutil.mixin(DataAccessObject, Inclusion);
jutil.mixin(DataAccessObject, Relation);
