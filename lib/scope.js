var i8n = require('inflection');
var utils = require('./utils');
var defineCachedRelations = utils.defineCachedRelations;
/**
 * Module exports
 */
exports.defineScope = defineScope;
exports.mergeQuery = mergeQuery;

function ScopeDefinition(definition) {
  this.isStatic = definition.isStatic;
  this.modelFrom = definition.modelFrom;
  this.modelTo = definition.modelTo || definition.modelFrom;
  this.name = definition.name;
  this.params = definition.params;
  this.methods = definition.methods;
  this.options = definition.options;
}

ScopeDefinition.prototype.related = function(receiver, scopeParams, condOrRefresh, cb) {
  var name = this.name;
  var self = receiver;
  
  var actualCond = {};
  var actualRefresh = false;
  var saveOnCache = true;
  if (arguments.length === 3) {
    cb = condOrRefresh;
  } else if (arguments.length === 4) {
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
    // It either doesn't hit the cache or refresh is required
    var params = mergeQuery(actualCond, scopeParams);
    return this.modelTo.find(params, function (err, data) {
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
}

/**
 * Define a scope method
 * @param {String} name of the method
 * @param {Function} function to define
 */
ScopeDefinition.prototype.defineMethod = function(name, fn) {
  return this.methods[name] = fn;
}

/**
 * Define a scope to the class
 * @param {Model} cls The class where the scope method is added
 * @param {Model} targetClass The class that a query to run against
 * @param {String} name The name of the scope
 * @param {Object|Function} params The parameters object for the query or a function
 * to return the query object
 * @param methods An object of methods keyed by the method name to be bound to the class
 */
function defineScope(cls, targetClass, name, params, methods, options) {

  // collect meta info about scope
  if (!cls._scopeMeta) {
    cls._scopeMeta = {};
  }

  // only makes sense to add scope in meta if base and target classes
  // are same
  if (cls === targetClass) {
    cls._scopeMeta[name] = params;
  } else {
    if (!targetClass._scopeMeta) {
      targetClass._scopeMeta = {};
    }
  }

  options = options || {};
  // Check if the cls is the class itself or its prototype
  var isStatic = (typeof cls === 'function') || options.isStatic || false;
  var definition = new ScopeDefinition({
    isStatic: isStatic,
    modelFrom: cls,
    modelTo: targetClass,
    name: name,
    params: params,
    methods: methods,
    options: options || {}
  });

  if(isStatic) {
    cls.scopes = cls.scopes || {};
    cls.scopes[name] = definition;
  } else {
    cls.constructor.scopes = cls.constructor.scopes || {};
    cls.constructor.scopes[name] = definition;
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
      var f = function(condOrRefresh, cb) {
        if(arguments.length === 1) {
          definition.related(self, f._scope, condOrRefresh);
        } else {
          definition.related(self, f._scope, condOrRefresh, cb);
        }
      };

      f._scope = typeof definition.params === 'function' ?
        definition.params.call(self) : definition.params;

      f._targetClass = definition.modelTo.modelName;
      if (f._scope.collect) {
        f._targetClass = i8n.capitalize(f._scope.collect);
      }

      f.build = build;
      f.create = create;
      f.destroyAll = destroyAll;
      f.count = count;
      for (var i in definition.methods) {
        f[i] = definition.methods[i].bind(self);
      }

      // Define scope-chaining, such as
      // Station.scope('active', {where: {isActive: true}});
      // Station.scope('subway', {where: {isUndeground: true}});
      // Station.active.subway(cb);
      Object.keys(targetClass._scopeMeta).forEach(function (name) {
        Object.defineProperty(f, name, {
          enumerable: false,
          get: function () {
            mergeQuery(f._scope, targetClass._scopeMeta[name]);
            return f;
          }
        });
      }.bind(self));
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

  cls['__get__' + name] = fn;

  var fn_create = function () {
    var f = this[name].create;
    f.apply(this[name], arguments);
  };

  cls['__create__' + name] = fn_create;

  var fn_delete = function () {
    var f = this[name].destroyAll;
    f.apply(this[name], arguments);
  };

  cls['__delete__' + name] = fn_delete;

  var fn_count = function (cb) {
    var f = this[name].count;
    f.apply(this[name], arguments);
  };

  cls['__count__' + name] = fn_count;

  /*
   * Extracting fixed property values for the scope from the where clause into
   * the data object
   *
   * @param {Object} The data object
   * @param {Object} The where clause
   */
  function setScopeValuesFromWhere(data, where) {
    for (var i in where) {
      if (i === 'and') {
        // Find fixed property values from each subclauses
        for (var w = 0, n = where[i].length; w < n; w++) {
          setScopeValuesFromWhere(data, where[i][w]);
        }
        continue;
      }
      var prop = targetClass.definition.properties[i];
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

  // and it should have create/build methods with binded thisModelNameId param
  function build(data) {
    data = data || {};
    // Find all fixed property values for the scope
    var where = (this._scope && this._scope.where) || {};
    setScopeValuesFromWhere(data, where);
    return new targetClass(data);
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
    var where = (this._scope && this._scope.where) || {};
    targetClass.destroyAll(where, cb);
  }

  function count(cb) {
    var where = (this._scope && this._scope.where) || {};
    targetClass.count(where, cb);
  } 
  
  return definition;
}

/*!
 * Merge query parameters
 * @param {Object} base The base object to contain the merged results
 * @param {Object} update The object containing updates to be merged
 * @returns {*|Object} The base object
 * @private
 */
function mergeQuery(base, update) {
  if (!update) {
    return;
  }
  base = base || {};
  if (update.where && Object.keys(update.where).length > 0) {
    if (base.where && Object.keys(base.where).length > 0) {
      base.where = {and: [base.where, update.where]};
    } else {
      base.where = update.where;
    }
  }

  // Merge inclusion
  if (update.include) {
    if (!base.include) {
      base.include = update.include;
    } else {
      var saved = base.include;
      base.include = {};
      base.include[update.include] = saved;
    }
  }
  if (update.collect) {
    base.collect = update.collect;
  }

  // set order
  if (!base.order && update.order) {
    base.order = update.order;
  }
  
  // overwrite pagination
  if (update.limit !== undefined) {
    base.limit = update.limit;
  }
  if (update.skip !== undefined) {
    base.skip = update.skip;
  }
  if (update.offset !== undefined) {
    base.offset = update.offset;
  }

  // Overwrite fields
  if (update.fields !== undefined) {
    base.fields = update.fields;
  }
  return base;
}

