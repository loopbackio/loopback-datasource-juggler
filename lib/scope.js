var i8n = require('inflection');
var utils = require('./utils');
var defineCachedRelations = utils.defineCachedRelations;
/**
 * Module exports
 */
exports.defineScope = defineScope;

/**
 * Define a scope to the class
 * @param {Model} cls The class where the scope method is added
 * @param {Model} targetClass The class that a query to run against
 * @param {String} name The name of the scope
 * @param {Object|Function} params The parameters object for the query or a function
 * to return the query object
 * @param methods An object of methods keyed by the method name to be bound to the class
 */
function defineScope(cls, targetClass, name, params, methods) {

  // collect meta info about scope
  if (!cls._scopeMeta) {
    cls._scopeMeta = {};
  }

  // only makes sence to add scope in meta if base and target classes
  // are same
  if (cls === targetClass) {
    cls._scopeMeta[name] = params;
  } else {
    if (!targetClass._scopeMeta) {
      targetClass._scopeMeta = {};
    }
  }

  // Define a property for the scope
  Object.defineProperty(cls, name, {
    enumerable: false,
    configurable: true,
    /**
     * This defines a property for the scope. For example, user.accounts or
     * User.vips. Please note the cls can be the model class or prototype of
     * the model class.
     *
     * The property value is function. It can be used to query the scope,
     * such as user.accounts(condOrRefresh, cb) or User.vips(cb). The value
     * can also have child properties for create/build/delete. For example,
     * user.accounts.create(act, cb).
     *
     */
    get: function () {
      var self = this;
      var f = function caller(condOrRefresh, cb) {
        var actualCond = {};
        var actualRefresh = false;
        var saveOnCache = true;
        if (arguments.length === 1) {
          cb = condOrRefresh;
        } else if (arguments.length === 2) {
          if (typeof condOrRefresh === 'boolean') {
            actualRefresh = condOrRefresh;
          } else {
            actualCond = condOrRefresh;
            actualRefresh = true;
            saveOnCache = false;
          }
        } else {
          throw new Error('Method can be only called with one or two arguments');
        }

        if (!self.__cachedRelations || self.__cachedRelations[name] === undefined
          || actualRefresh) {
          // It either doesn't hit the cache or reresh is required
          var params = mergeParams(actualCond, caller._scope);
          return targetClass.find(params, function (err, data) {
            if (!err && saveOnCache) {
              defineCachedRelations(self);
              self.__cachedRelations[name] = data;
            }
            cb(err, data);
          });
        } else {
          // Return from cache
          cb(null, self.__cachedRelations[name]);
        }
      };
      f._scope = typeof params === 'function' ? params.call(this) : params;
      f._targetClass = targetClass.modelName;
      if (f._scope.collect) {
        f._targetClass = i8n.capitalize(f._scope.collect);
      }

      f.build = build;
      f.create = create;
      f.destroyAll = destroyAll;
      for (var i in methods) {
        f[i] = methods[i].bind(this);
      }

      // define sub-scopes
      Object.keys(targetClass._scopeMeta).forEach(function (name) {
        Object.defineProperty(f, name, {
          enumerable: false,
          get: function () {
            mergeParams(f._scope, targetClass._scopeMeta[name]);
            return f;
          }
        });
      }.bind(this));
      return f;
    }
  });

  // Wrap the property into a function for remoting
  var fn = function () {
    // primaryObject.scopeName, such as user.accounts
    var f = this[name];
    // set receiver to be the scope property whose value is a function
    f.apply(this[name], arguments);
  };

  fn.shared = true;
  fn.http = {verb: 'get', path: '/' + name};
  fn.accepts = {arg: 'filter', type: 'object'};
  fn.description = 'Queries ' + name + ' of this model.';
  fn.returns = {arg: name, type: 'array', root: true};

  cls['__get__' + name] = fn;

  var fn_create = function () {
    var f = this[name].create;
    f.apply(this[name], arguments);
  };

  fn_create.shared = true;
  fn_create.http = {verb: 'post', path: '/' + name};
  fn_create.accepts = {arg: 'data', type: 'object', http: {source: 'body'}};
  fn_create.description = 'Creates a new instance in ' + name + ' of this model.';
  fn_create.returns = {arg: 'data', type: 'object', root: true};

  cls['__create__' + name] = fn_create;

  var fn_delete = function () {
    var f = this[name].destroyAll;
    f.apply(this[name], arguments);
  };
  fn_delete.shared = true;
  fn_delete.http = {verb: 'delete', path: '/' + name};
  fn_delete.description = 'Deletes all ' + name + ' of this model.';
  fn_delete.returns = {arg: 'data', type: 'object', root: true};

  cls['__delete__' + name] = fn_delete;

  // and it should have create/build methods with binded thisModelNameId param
  function build(data) {
    return new targetClass(mergeParams(this._scope, {where: data || {}}).where);
  }

  function create(data, cb) {
    if (typeof data === 'function') {
      cb = data;
      data = {};
    }
    this.build(data).save(cb);
  }

  /*
   Callback
   - The callback will be called after all elements are destroyed
   - For every destroy call which results in an error
   - If fetching the Elements on which destroyAll is called results in an error
   */
  function destroyAll(cb) {
    targetClass.find(this._scope, function (err, data) {
      if (err) {
        cb(err);
      } else {
        (function loopOfDestruction(data) {
          if (data.length > 0) {
            data.shift().destroy(function (err) {
              if (err && cb) cb(err);
              loopOfDestruction(data);
            });
          } else {
            if (cb) cb();
          }
        }(data));
      }
    });
  }

  function mergeParams(base, update) {
    base = base || {};
    if (update.where) {
      base.where = merge(base.where, update.where);
    }
    if (update.include) {
      base.include = update.include;
    }
    if (update.collect) {
      base.collect = update.collect;
    }

    // overwrite order
    if (update.order) {
      base.order = update.order;
    }

    if(update.limit !== undefined) {
      base.limit = update.limit;
    }
    if(update.skip !== undefined) {
      base.skip = update.skip;
    }
    if(update.offset !== undefined) {
      base.offset = update.offset;
    }
    if(update.fields !== undefined) {
      base.fields = update.fields;
    }
    return base;

  }
}

/**
 * Merge `base` and `update` params
 * @param {Object} base - base object (updating this object)
 * @param {Object} update - object with new data to update base
 * @returns {Object} `base`
 */
function merge(base, update) {
  base = base || {};
  if (update) {
    Object.keys(update).forEach(function (key) {
      base[key] = update[key];
    });
  }
  return base;
}

