var i8n = require('inflection');
var utils = require('./utils');
var defineCachedRelations = utils.defineCachedRelations;
var setScopeValuesFromWhere = utils.setScopeValuesFromWhere;
var mergeQuery = utils.mergeQuery;
var DefaultModelBaseClass = require('./model.js');

/**
 * Module exports
 */
exports.defineScope = defineScope;

function ScopeDefinition(definition) {
  this.isStatic = definition.isStatic;
  this.modelFrom = definition.modelFrom;
  this.modelTo = definition.modelTo || definition.modelFrom;
  this.name = definition.name;
  this.params = definition.params;
  this.methods = definition.methods || {};
  this.options = definition.options || {};
}

ScopeDefinition.prototype.targetModel = function(receiver) {
  if (typeof this.options.modelTo === 'function') {
    var modelTo = this.options.modelTo.call(this, receiver) || this.modelTo;
  } else {
    var modelTo = this.modelTo;
  }
  if (!(modelTo.prototype instanceof DefaultModelBaseClass)) {
    var msg = 'Invalid target model for scope `';
    msg += (this.isStatic ? this.modelFrom : this.modelFrom.constructor).modelName;
    msg += this.isStatic ? '.' : '.prototype.';
    msg += this.name + '`.';
    throw new Error(msg);
  }
  return modelTo;
};

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
    var targetModel = this.targetModel(receiver);
    targetModel.find(params, function (err, data) {
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
  } else if (targetClass) {
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
    options: options
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
      var targetModel = definition.targetModel(this);
      var self = this;
      
      var f = function(condOrRefresh, cb) {
        if (arguments.length === 0) {
          if (typeof f.value === 'function') {
            return f.value(self);
          } else if (self.__cachedRelations) {
            return self.__cachedRelations[name];
          }
        } else {
          // Check if there is a through model
          // see https://github.com/strongloop/loopback/issues/1076
          if (f._scope.collect &&
            condOrRefresh !== null && typeof condOrRefresh === 'object') {
            // Adjust the include so that the condition will be applied to
            // the target model
            f._scope.include = {
              relation: f._scope.collect,
              scope: condOrRefresh
            };
            condOrRefresh = {};
          }
          if (arguments.length === 1) {
            return definition.related(self, f._scope, condOrRefresh);
          } else {
            return definition.related(self, f._scope, condOrRefresh, cb);
          }
        }
      };
      
      f._receiver = this;
      f._scope = typeof definition.params === 'function' ?
        definition.params.call(self) : definition.params;
      
      f._targetClass = targetModel.modelName;
      if (f._scope.collect) {
        f._targetClass = i8n.camelize(f._scope.collect);
      }
      
      f.build = build;
      f.create = create;
      f.destroyAll = destroyAll;
      f.count = count;
      for (var i in definition.methods) {
        f[i] = definition.methods[i].bind(self);
      }
      
      if (!targetClass) return f;

      // Define scope-chaining, such as
      // Station.scope('active', {where: {isActive: true}});
      // Station.scope('subway', {where: {isUndeground: true}});
      // Station.active.subway(cb);
      Object.keys(targetClass._scopeMeta).forEach(function (name) {
        Object.defineProperty(f, name, {
          enumerable: false,
          get: function () {
            mergeQuery(f._scope, targetModel._scopeMeta[name]);
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

  // and it should have create/build methods with binded thisModelNameId param
  function build(data) {
    data = data || {};
    // Find all fixed property values for the scope
    var targetModel = definition.targetModel(this._receiver);
    var where = (this._scope && this._scope.where) || {};
    setScopeValuesFromWhere(data, where, targetModel);
    return new targetModel(data);
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
  function destroyAll(where, cb) {
    if (typeof where === 'function') cb = where, where = {};
    var scoped = (this._scope && this._scope.where) || {};
    var filter = mergeQuery({ where: scoped }, { where: where || {} });
    var targetModel = definition.targetModel(this._receiver);
    targetModel.destroyAll(filter.where, cb);
  }

  function count(where, cb) {
    if (typeof where === 'function') cb = where, where = {};
    var scoped = (this._scope && this._scope.where) || {};
    var filter = mergeQuery({ where: scoped }, { where: where || {} });
    var targetModel = definition.targetModel(this._receiver);
    targetModel.count(filter.where, cb);
  } 
  
  return definition;
}
