// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
'use strict';

var _ = require('lodash');
var i8n = require('inflection');
var g = require('strong-globalize')();
var utils = require('./utils');
var defineCachedRelations = utils.defineCachedRelations;
var setScopeValuesFromWhere = utils.setScopeValuesFromWhere;
var mergeQuery = utils.mergeQuery;
var DefaultModelBaseClass = require('./model.js');
var collectTargetIds = utils.collectTargetIds;
var idName = utils.idName;
var deprecated = require('depd')('loopback-datasource-juggler');

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
  var modelTo;
  if (typeof this.options.modelTo === 'function') {
    modelTo = this.options.modelTo.call(this, receiver) || this.modelTo;
  } else {
    modelTo = this.modelTo;
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

/*!
 * Find related model instances
 * @param {*} receiver The target model class/prototype
 * @param {Object|Function} scopeParams
 * @param {Boolean|Object} [condOrRefresh] true for refresh or object as a filter
 * @param {Object} [options]
 * @param {Function} cb
 * @returns {*}
 */
ScopeDefinition.prototype.related = function(receiver, scopeParams, condOrRefresh, options, cb) {
  var name = this.name;
  var self = receiver;

  var actualCond = {};
  var actualRefresh = false;
  var saveOnCache = receiver instanceof DefaultModelBaseClass;
  if (typeof condOrRefresh === 'function' &&
    options === undefined && cb === undefined) {
    // related(receiver, scopeParams, cb)
    cb = condOrRefresh;
    options = {};
    condOrRefresh = undefined;
  } else if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  options = options || {};
  if (condOrRefresh !== undefined) {
    if (typeof condOrRefresh === 'boolean') {
      actualRefresh = condOrRefresh;
    } else {
      actualCond = condOrRefresh;
      actualRefresh = true;
      saveOnCache = false;
    }
  }
  cb = cb || utils.createPromiseCallback();
  const refreshIsNeeded = !self.__cachedRelations ||
    self.__cachedRelations[name] === undefined ||
    actualRefresh;
  if (refreshIsNeeded) {
    // It either doesn't hit the cache or refresh is required
    var params = mergeQuery(actualCond, scopeParams, {nestedInclude: true});
    var targetModel = this.targetModel(receiver);

    // If there is a through model
    // run another query to apply filter on relatedModel(targetModel)
    // see github.com/strongloop/loopback-datasource-juggler/issues/166
    var scopeOnRelatedModel = params.collect &&
      params.include.scope !== null &&
      typeof params.include.scope === 'object';
    if (scopeOnRelatedModel) {
      var filter = params.include;
      // The filter applied on relatedModel
      var queryRelated = filter.scope;
      delete params.include.scope;
    };

    targetModel.find(params, options, function(err, data) {
      if (!err && saveOnCache) {
        defineCachedRelations(self);
        self.__cachedRelations[name] = data;
      }

      if (scopeOnRelatedModel === true) {
        var relatedModel = targetModel.relations[filter.relation].modelTo;
        var IdKey = idName(relatedModel);

        // return {inq: [1,2,3]}}
        var smartMerge = function(idCollection, qWhere) {
          if (!qWhere[IdKey]) return idCollection;
          var merged = {};

          var idsA = idCollection.inq;
          var idsB = qWhere[IdKey].inq ? qWhere[IdKey].inq : [qWhere[IdKey]];

          var intersect = _.intersectionWith(idsA, idsB, _.isEqual);
          if (intersect.length === 1) merged = intersect[0];
          if (intersect.length > 1) merged = {inq: intersect};

          return merged;
        };

        if (queryRelated.where !== undefined) {
          // Merge queryRelated filter and targetId filter
          var IdKeyCondition = {};
          IdKeyCondition[IdKey] = smartMerge(collectTargetIds(data, IdKey),
            queryRelated.where);

          // if the id in filter doesn't exist after the merge,
          // return empty result
          if (_.isObject(IdKeyCondition[IdKey]) && _.isEmpty(IdKeyCondition[IdKey])) return cb(null, []);

          var mergedWhere = {
            and: [
              IdKeyCondition,
              _.omit(queryRelated.where, IdKey),
            ],
          };
          queryRelated.where = mergedWhere;
        } else {
          queryRelated.where = {};
          queryRelated.where[IdKey] = collectTargetIds(data, IdKey);
        }

        relatedModel.find(queryRelated, options, cb);
      } else {
        cb(err, data);
      }
    });
  } else {
    // Return from cache
    cb(null, self.__cachedRelations[name]);
  }
  return cb.promise;
};

/**
 * Define a scope method
 * @param {String} name of the method
 * @param {Function} function to define
 */
ScopeDefinition.prototype.defineMethod = function(name, fn) {
  return this.methods[name] = fn;
};

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
    options: options,
  });

  if (isStatic) {
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
    get: function() {
      var targetModel = definition.targetModel(this);
      var self = this;

      var f = function(condOrRefresh, options, cb) {
        if (arguments.length === 0) {
          if (typeof f.value === 'function') {
            return f.value(self);
          } else if (self.__cachedRelations) {
            return self.__cachedRelations[name];
          }
        } else {
          const condOrRefreshIsCallBack = typeof condOrRefresh === 'function' &&
            options === undefined &&
            cb === undefined;
          if (condOrRefreshIsCallBack) {
            // customer.orders(cb)
            cb = condOrRefresh;
            options = {};
            condOrRefresh = undefined;
          } else if (typeof options === 'function' && cb === undefined) {
            // customer.orders(condOrRefresh, cb);
            cb = options;
            options = {};
          }
          options = options || {};
          // Check if there is a through model
          // see https://github.com/strongloop/loopback/issues/1076
          if (f._scope.collect &&
            condOrRefresh !== null && typeof condOrRefresh === 'object') {
            f._scope.include = {
              relation: f._scope.collect,
              scope: condOrRefresh,
            };
            condOrRefresh = {};
          }
          return definition.related(self, f._scope, condOrRefresh, options, cb);
        }
      };

      f._receiver = this;
      f._scope = typeof definition.params === 'function' ?
        definition.params.call(self) : definition.params;

      f._targetClass = targetModel.modelName;
      if (f._scope.collect) {
        const rel = targetModel.relations[f._scope.collect];
        f._targetClass = rel && rel.modelTo && rel.modelTo.modelName || i8n.camelize(f._scope.collect);
      }

      f.find = function(condOrRefresh, options, cb) {
        if (typeof condOrRefresh === 'function' &&
            options === undefined && cb === undefined) {
          cb = condOrRefresh;
          options = {};
          condOrRefresh = {};
        } else if (typeof options === 'function' && cb === undefined) {
          cb = options;
          options = {};
        }
        options = options || {};
        return definition.related(self, f._scope, condOrRefresh, options, cb);
      };

      f.getAsync = function() {
        deprecated(g.f('Scope method "getAsync()" is deprecated, use "find()" instead.'));
        return this.find.apply(this, arguments);
      };

      f.build = build;
      f.create = create;
      f.updateAll = updateAll;
      f.destroyAll = destroyAll;
      f.findById = findById;
      f.findOne = findOne;
      f.count = count;

      for (var i in definition.methods) {
        f[i] = definition.methods[i].bind(self);
      }

      if (!targetClass) return f;

      // Define scope-chaining, such as
      // Station.scope('active', {where: {isActive: true}});
      // Station.scope('subway', {where: {isUndeground: true}});
      // Station.active.subway(cb);
      Object.keys(targetClass._scopeMeta).forEach(function(name) {
        Object.defineProperty(f, name, {
          enumerable: false,
          get: function() {
            mergeQuery(f._scope, targetModel._scopeMeta[name]);
            return f;
          },
        });
      }.bind(self));
      return f;
    },
  });

  // Wrap the property into a function for remoting
  var fn = function() {
    // primaryObject.scopeName, such as user.accounts
    var f = this[name];
    // set receiver to be the scope property whose value is a function
    f.apply(this[name], arguments);
  };

  cls['__get__' + name] = fn;

  var fnCreate = function() {
    var f = this[name].create;
    f.apply(this[name], arguments);
  };

  cls['__create__' + name] = fnCreate;

  var fnDelete = function() {
    var f = this[name].destroyAll;
    f.apply(this[name], arguments);
  };

  cls['__delete__' + name] = fnDelete;

  var fnUpdate = function() {
    var f = this[name].updateAll;
    f.apply(this[name], arguments);
  };

  cls['__update__' + name] = fnUpdate;

  var fnFindById = function(cb) {
    var f = this[name].findById;
    f.apply(this[name], arguments);
  };

  cls['__findById__' + name] = fnFindById;

  var fnFindOne = function(cb) {
    var f = this[name].findOne;
    f.apply(this[name], arguments);
  };

  cls['__findOne__' + name] = fnFindOne;

  var fnCount = function(cb) {
    var f = this[name].count;
    f.apply(this[name], arguments);
  };

  cls['__count__' + name] = fnCount;

  // and it should have create/build methods with binded thisModelNameId param
  function build(data) {
    data = data || {};
    // Find all fixed property values for the scope
    var targetModel = definition.targetModel(this._receiver);
    var where = (this._scope && this._scope.where) || {};
    setScopeValuesFromWhere(data, where, targetModel);
    return new targetModel(data);
  }

  function create(data, options, cb) {
    if (typeof data === 'function' &&
      options === undefined && cb === undefined) {
      // create(cb)
      cb = data;
      data = {};
    } else if (typeof options === 'function' && cb === undefined) {
      // create(data, cb)
      cb = options;
      options = {};
    }
    options = options || {};
    return this.build(data).save(options, cb);
  }

  /*
   Callback
   - The callback will be called after all elements are destroyed
   - For every destroy call which results in an error
   - If fetching the Elements on which destroyAll is called results in an error
   */
  function destroyAll(where, options, cb) {
    if (typeof where === 'function') {
      // destroyAll(cb)
      cb = where;
      where = {};
    } else if (typeof options === 'function' && cb === undefined) {
      // destroyAll(where, cb)
      cb = options;
      options = {};
    }
    options = options || {};

    var targetModel = definition.targetModel(this._receiver);
    var scoped = (this._scope && this._scope.where) || {};
    var filter = mergeQuery({where: scoped}, {where: where || {}});
    return targetModel.destroyAll(filter.where, options, cb);
  }

  function updateAll(where, data, options, cb) {
    if (typeof data === 'function' &&
      options === undefined && cb === undefined) {
      // updateAll(data, cb)
      cb = data;
      data = where;
      where = {};
      options = {};
    } else if (typeof options === 'function' && cb === undefined) {
      // updateAll(where, data, cb)
      cb = options;
      options = {};
    }
    options = options || {};
    var targetModel = definition.targetModel(this._receiver);
    var scoped = (this._scope && this._scope.where) || {};
    var filter = mergeQuery({where: scoped}, {where: where || {}});
    return targetModel.updateAll(filter.where, data, options, cb);
  }

  function findById(id, filter, options, cb) {
    if (options === undefined && cb === undefined) {
      if (typeof filter === 'function') {
        // findById(id, cb)
        cb = filter;
        filter = {};
      }
    } else if (cb === undefined) {
      if (typeof options === 'function') {
        // findById(id, query, cb)
        cb = options;
        options = {};
        if (typeof filter === 'object' && !(filter.include || filter.fields)) {
          // If filter doesn't have include or fields, assuming it's options
          options = filter;
          filter = {};
        }
      }
    }

    options = options || {};
    filter = filter || {};
    var targetModel = definition.targetModel(this._receiver);
    var idName = targetModel.definition.idName();
    var query = {where: {}};
    query.where[idName] = id;
    query = mergeQuery(query, filter);
    return this.findOne(query, options, cb);
  }

  function findOne(filter, options, cb) {
    if (typeof filter === 'function') {
      // findOne(cb)
      cb = filter;
      filter = {};
      options = {};
    } else if (typeof options === 'function' && cb === undefined) {
      // findOne(filter, cb)
      cb = options;
      options = {};
    }
    options = options || {};
    var targetModel = definition.targetModel(this._receiver);
    var scoped = (this._scope && this._scope.where) || {};
    filter = mergeQuery({where: scoped}, filter || {});
    return targetModel.findOne(filter, options, cb);
  }

  function count(where, options, cb) {
    if (typeof where === 'function') {
      // count(cb)
      cb = where;
      where = {};
    } else if (typeof options === 'function' && cb === undefined) {
      // count(where, cb)
      cb = options;
      options = {};
    }
    options = options || {};

    var targetModel = definition.targetModel(this._receiver);
    var scoped = (this._scope && this._scope.where) || {};
    var filter = mergeQuery({where: scoped}, {where: where || {}});
    return targetModel.count(filter.where, options, cb);
  }

  return definition;
}
