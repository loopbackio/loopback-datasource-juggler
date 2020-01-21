// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const async = require('async');
const g = require('strong-globalize')();
const utils = require('./utils');
const List = require('./list');
const includeUtils = require('./include_utils');
const isPlainObject = utils.isPlainObject;
const defineCachedRelations = utils.defineCachedRelations;
const uniq = utils.uniq;
const idName = utils.idName;
const debug = require('debug')('loopback:include');

const DISALLOWED_TYPES = ['boolean', 'number', 'symbol', 'function'];

/*!
 * Normalize the include to be an array
 * @param include
 * @returns {*}
 */
function normalizeInclude(include) {
  let newInclude;
  if (typeof include === 'string') {
    return [include];
  } else if (isPlainObject(include)) {
    // Build an array of key/value pairs
    newInclude = [];
    const rel = include.rel || include.relation;
    const obj = {};
    if (typeof rel === 'string') {
      obj[rel] = new IncludeScope(include.scope);
      newInclude.push(obj);
    } else {
      for (const key in include) {
        obj[key] = include[key];
        newInclude.push(obj);
      }
    }
    return newInclude;
  } else if (Array.isArray(include)) {
    newInclude = [];
    for (let i = 0, n = include.length; i < n; i++) {
      const subIncludes = normalizeInclude(include[i]);
      newInclude = newInclude.concat(subIncludes);
    }
    return newInclude;
  } else if (DISALLOWED_TYPES.includes(typeof include)) {
    debug('Ignoring invalid "include" value of type %s:', typeof include, include);
    return [];
  } else {
    return include;
  }
}

function IncludeScope(scope) {
  this._scope = utils.deepMerge({}, scope || {});
  if (this._scope.include) {
    this._include = normalizeInclude(this._scope.include);
    delete this._scope.include;
  } else {
    this._include = null;
  }
}

IncludeScope.prototype.conditions = function() {
  return utils.deepMerge({}, this._scope);
};

IncludeScope.prototype.include = function() {
  return this._include;
};

/*!
 * Look up a model by name from the list of given models
 * @param {Object} models Models keyed by name
 * @param {String} modelName The model name
 * @returns {*} The matching model class
 */
function lookupModel(models, modelName) {
  if (models[modelName]) {
    return models[modelName];
  }
  const lookupClassName = modelName.toLowerCase();
  for (const name in models) {
    if (name.toLowerCase() === lookupClassName) {
      return models[name];
    }
  }
}

/**
 * Utility Function to allow interleave before and after high computation tasks
 * @param tasks
 * @param callback
 */
function execTasksWithInterLeave(tasks, callback) {
  // let's give others some time to process.
  // Context Switch BEFORE Heavy Computation
  process.nextTick(function() {
    // Heavy Computation
    try {
      async.parallel(tasks, function(err, info) {
        // Context Switch AFTER Heavy Computation
        process.nextTick(function() {
          callback(err, info);
        });
      });
    } catch (err) {
      callback(err);
    }
  });
}

/*!
 * Include mixin for ./model.js
 */
module.exports = Inclusion;

/**
 * Inclusion - Model mixin.
 *
 * @class
 */

function Inclusion() {
}

/**
 * Normalize includes - used in DataAccessObject
 *
 */

Inclusion.normalizeInclude = normalizeInclude;

/**
 * Enables you to load relations of several objects and optimize numbers of requests.
 *
 * Examples:
 *
 * Load all users' posts with only one additional request:
 * `User.include(users, 'posts', function() {});`
 * Or
 * `User.include(users, ['posts'], function() {});`
 *
 * Load all users posts and passports with two additional requests:
 * `User.include(users, ['posts', 'passports'], function() {});`
 *
 * Load all passports owner (users), and all posts of each owner loaded:
 *```Passport.include(passports, {owner: 'posts'}, function() {});
 *``` Passport.include(passports, {owner: ['posts', 'passports']});
 *``` Passport.include(passports, {owner: [{posts: 'images'}, 'passports']});
 *
 * @param {Array} objects Array of instances
 * @param {String|Object|Array} include Which relations to load.
 * @param {Object} [options] Options for CRUD
 * @param {Function} cb Callback called when relations are loaded
 *
 */
Inclusion.include = function(objects, include, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  const self = this;

  if (!include || (Array.isArray(include) && include.length === 0) ||
      (Array.isArray(objects) && objects.length === 0) ||
      (isPlainObject(include) && Object.keys(include).length === 0)) {
    // The objects are empty
    return process.nextTick(function() {
      cb && cb(null, objects);
    });
  }

  include = normalizeInclude(include);
  debug('include: %j', include);

  // Find the limit of items for `inq`
  let inqLimit = 256;
  if (self.dataSource && self.dataSource.settings &&
    self.dataSource.settings.inqLimit) {
    inqLimit = self.dataSource.settings.inqLimit;
  }

  async.each(include, function(item, callback) {
    try {
      processIncludeItem(objects, item, options, callback);
    } catch (err) {
      // async does not catch the error and report to the outer callback
      callback(err);
    }
  }, function(err) {
    debug(err, objects);
    cb && cb(err, objects);
  });

  /**
   * Find related items with an array of foreign keys by page
   * @param model The model class
   * @param filter The query filter
   * @param fkName The name of the foreign key property
   * @param pageSize The size of page
   * @param options Options
   * @param cb
   */
  function findWithForeignKeysByPage(model, filter, fkName, pageSize, options, cb) {
    try {
      const opts = Object.assign({prohibitProtectedPropertiesInQuery: true}, options);
      model._sanitizeQuery(filter.where, opts);
      model._coerce(filter.where, options);
    } catch (e) {
      return cb(e);
    }

    let foreignKeys = [];
    if (filter.where[fkName]) {
      foreignKeys = filter.where[fkName].inq;
    } else if (filter.where.and) {
      // The inq can be embedded inside 'and: []'. No or: [] is needed as
      // include only uses and. We only deal with the generated inq for include.
      for (const j in filter.where.and) {
        if (filter.where.and[j][fkName] &&
          Array.isArray(filter.where.and[j][fkName].inq)) {
          foreignKeys = filter.where.and[j][fkName].inq;
          break;
        }
      }
    }
    if (!foreignKeys.length) {
      return cb(null, []);
    }
    if (filter.limit || filter.skip || filter.offset) {
      // Force the find to be performed per FK to honor the pagination
      pageSize = 1;
    }
    const size = foreignKeys.length;
    if (size > inqLimit && pageSize <= 0) {
      pageSize = inqLimit;
    }
    if (pageSize <= 0) {
      return model.find(filter, options, cb);
    }

    let listOfFKs = [];

    for (let i = 0; i < size; i += pageSize) {
      let end = i + pageSize;
      if (end > size) {
        end = size;
      }
      listOfFKs.push(foreignKeys.slice(i, end));
    }

    let items = [];
    // Optimization: no need to resolve keys that are an empty array
    listOfFKs = listOfFKs.filter(function(keys) {
      return keys.length > 0;
    });
    async.each(listOfFKs, function(foreignKeys, done) {
      const newFilter = {};
      for (const f in filter) {
        newFilter[f] = filter[f];
      }
      if (filter.where) {
        newFilter.where = {};
        for (const w in filter.where) {
          newFilter.where[w] = filter.where[w];
        }
      }
      newFilter.where[fkName] = foreignKeys.length === 1 ? foreignKeys[0] : {
        inq: foreignKeys,
      };
      model.find(newFilter, options, function(err, results) {
        if (err) return done(err);
        items = items.concat(results);
        done();
      });
    }, function(err) {
      if (err) return cb(err);
      cb(null, items);
    });
  }

  function processIncludeItem(objs, include, options, cb) {
    const relations = self.relations;

    let relationName;
    let subInclude = null, scope = null;

    if (isPlainObject(include)) {
      relationName = Object.keys(include)[0];
      if (include[relationName] instanceof IncludeScope) {
        scope = include[relationName];
        subInclude = scope.include();
      } else {
        subInclude = include[relationName];
        // when include = {user:true}, it does not have subInclude
        if (subInclude === true) {
          subInclude = null;
        }
      }
    } else {
      relationName = include;
      subInclude = null;
    }

    const relation = relations[relationName];
    if (!relation) {
      cb(new Error(g.f('Relation "%s" is not defined for %s model', relationName, self.modelName)));
      return;
    }
    debug('Relation: %j', relation);
    const polymorphic = relation.polymorphic;
    // if (polymorphic && !polymorphic.discriminator) {
    //  cb(new Error('Relation "' + relationName + '" is polymorphic but ' +
    //    'discriminator is not present'));
    //  return;
    // }
    if (!relation.modelTo) {
      if (!relation.polymorphic) {
        cb(new Error(g.f('{{Relation.modelTo}} is not defined for relation %s and is no {{polymorphic}}',
          relationName)));
        return;
      }
    }

    // Just skip if inclusion is disabled
    if (relation.options.disableInclude) {
      debug('Relation is disabled from include', relation);
      return cb();
    }
    // prepare filter and fields for making DB Call
    const filter = (scope && scope.conditions()) || {};
    if ((relation.multiple || relation.type === 'belongsTo') && scope) {
      const includeScope = {};
      // make sure not to miss any fields for sub includes
      if (filter.fields && Array.isArray(subInclude) &&
        relation.modelTo.relations) {
        includeScope.fields = [];
        subInclude.forEach(function(name) {
          const rel = relation.modelTo.relations[name];
          if (rel && rel.type === 'belongsTo') {
            includeScope.fields.push(rel.keyFrom);
          }
        });
      }
      utils.mergeQuery(filter, includeScope, {fields: false});
    }
    // Let's add a placeholder where query
    filter.where = filter.where || {};
    // if fields are specified, make sure target foreign key is present
    let fields = filter.fields;
    if (typeof fields === 'string') {
      // transform string into array containing this string
      filter.fields = fields = [fields];
    }
    if (Array.isArray(fields) && fields.indexOf(relation.keyTo) === -1) {
      fields.push(relation.keyTo);
    } else if (isPlainObject(fields) && !fields[relation.keyTo]) {
      fields[relation.keyTo] = true;
    }

    //
    // call relation specific include functions
    //
    if (relation.multiple) {
      if (relation.modelThrough) {
        // hasManyThrough needs separate handling
        return includeHasManyThrough(cb);
      }
      // This will also include embedsMany with belongsTo.
      // Might need to optimize db calls for this.
      if (relation.type === 'embedsMany') {
        // embedded docs are part of the objects, no need to make db call.
        // proceed as implemented earlier.
        return includeEmbeds(cb);
      }
      if (relation.type === 'referencesMany') {
        return includeReferencesMany(cb);
      }

      // This handles exactly hasMany. Fast and straightforward. Without parallel, each and other boilerplate.
      if (relation.type === 'hasMany' && relation.multiple && !subInclude) {
        return includeHasManySimple(cb);
      }
      // assuming all other relations with multiple=true as hasMany
      return includeHasMany(cb);
    } else {
      if (polymorphic) {
        if (relation.type === 'hasOne') {
          return includePolymorphicHasOne(cb);
        }
        return includePolymorphicBelongsTo(cb);
      }
      if (relation.type === 'embedsOne') {
        return includeEmbeds(cb);
      }
      // hasOne or belongsTo
      return includeOneToOne(cb);
    }

    /**
     * Handle inclusion of HasManyThrough/HasAndBelongsToMany/Polymorphic
     * HasManyThrough relations
     * @param callback
     */
    function includeHasManyThrough(callback) {
      const sourceIds = [];
      // Map for Indexing objects by their id for faster retrieval
      const objIdMap = {};
      for (let i = 0; i < objs.length; i++) {
        const obj = objs[i];
        // one-to-many: foreign key reference is modelTo -> modelFrom.
        // use modelFrom.keyFrom in where filter later
        const sourceId = obj[relation.keyFrom];
        if (sourceId) {
          sourceIds.push(sourceId);
          objIdMap[sourceId.toString()] = obj;
        }
        // sourceId can be null. but cache empty data as result
        defineCachedRelations(obj);
        obj.__cachedRelations[relationName] = [];
      }
      // default filters are not applicable on through model. should be applied
      // on modelTo later in 2nd DB call.
      const throughFilter = {
        where: {},
      };
      throughFilter.where[relation.keyTo] = {
        inq: uniq(sourceIds),
      };
      if (polymorphic) {
        // handle polymorphic hasMany (reverse) in which case we need to filter
        // by discriminator to filter other types
        const throughModel = polymorphic.invert ? relation.modelTo : relation.modelFrom;
        throughFilter.where[polymorphic.discriminator] =
        throughModel.definition.name;
      }

      // 1st DB Call of 2-step process. Get through model objects first
      findWithForeignKeysByPage(relation.modelThrough, throughFilter,
        relation.keyTo, 0, options, throughFetchHandler);

      /**
       * Handle the results of Through model objects and fetch the modelTo items
       * @param err
       * @param {Array<Model>} throughObjs
       * @returns {*}
       */
      function throughFetchHandler(err, throughObjs) {
        if (err) {
          return callback(err);
        }
        // start preparing for 2nd DB call.
        const targetIds = [];
        const targetObjsMap = {};
        for (let i = 0; i < throughObjs.length; i++) {
          const throughObj = throughObjs[i];
          const targetId = throughObj[relation.keyThrough];
          if (targetId) {
            // save targetIds for 2nd DB Call
            targetIds.push(targetId);
            const sourceObj = objIdMap[throughObj[relation.keyTo]];
            const targetIdStr = targetId.toString();
            // Since targetId can be duplicates, multiple source objs are put
            // into buckets.
            const objList = targetObjsMap[targetIdStr] =
              targetObjsMap[targetIdStr] || [];
            objList.push(sourceObj);
          }
        }
        // Polymorphic relation does not have idKey of modelTo. Find it manually
        const modelToIdName = idName(relation.modelTo);
        filter.where[modelToIdName] = {
          inq: uniq(targetIds),
        };

        // make sure that the modelToIdName is included if fields are specified
        if (Array.isArray(fields) && fields.indexOf(modelToIdName) === -1) {
          fields.push(modelToIdName);
        } else if (isPlainObject(fields) && !fields[modelToIdName]) {
          fields[modelToIdName] = true;
        }

        // 2nd DB Call of 2-step process. Get modelTo (target) objects
        findWithForeignKeysByPage(relation.modelTo, filter,
          modelToIdName, 0, options, targetsFetchHandler);

        // relation.modelTo.find(filter, options, targetsFetchHandler);
        function targetsFetchHandler(err, targets) {
          if (err) {
            return callback(err);
          }
          const tasks = [];
          // simultaneously process subIncludes. Call it first as it is an async
          // process.
          if (subInclude && targets) {
            tasks.push(function subIncludesTask(next) {
              relation.modelTo.include(targets, subInclude, options, next);
            });
          }
          // process & link each target with object
          tasks.push(targetLinkingTask);
          function targetLinkingTask(next) {
            async.each(targets, linkManyToMany, next);
            function linkManyToMany(target, next) {
              const targetId = target[modelToIdName];
              if (!targetId) {
                const err = new Error(g.f(
                  'LinkManyToMany received target that doesn\'t contain required "%s"',
                  modelToIdName,
                ));
                return next(err);
              }
              const objList = targetObjsMap[targetId.toString()];
              async.each(objList, function(obj, next) {
                if (!obj) return next();
                obj.__cachedRelations[relationName].push(target);
                processTargetObj(obj, next);
              }, next);
            }
          }

          execTasksWithInterLeave(tasks, callback);
        }
      }
    }

    /**
     * Handle inclusion of ReferencesMany relation
     * @param callback
     */
    function includeReferencesMany(callback) {
      const modelToIdName = idName(relation.modelTo);
      let allTargetIds = [];
      // Map for Indexing objects by their id for faster retrieval
      const targetObjsMap = {};
      for (let i = 0; i < objs.length; i++) {
        const obj = objs[i];
        // one-to-many: foreign key reference is modelTo -> modelFrom.
        // use modelFrom.keyFrom in where filter later
        let targetIds = obj[relation.keyFrom];
        if (targetIds) {
          if (typeof targetIds === 'string') {
            // For relational DBs, the array is stored as stringified json
            // Please note obj is a plain object at this point
            targetIds = JSON.parse(targetIds);
          }
          // referencesMany has multiple targetIds per obj. We need to concat
          // them into allTargetIds before DB Call
          allTargetIds = allTargetIds.concat(targetIds);
          for (let j = 0; j < targetIds.length; j++) {
            const targetId = targetIds[j];
            const targetIdStr = targetId.toString();
            const objList = targetObjsMap[targetIdStr] =
              targetObjsMap[targetIdStr] || [];
            objList.push(obj);
          }
        }
        // sourceId can be null. but cache empty data as result
        defineCachedRelations(obj);
        obj.__cachedRelations[relationName] = [];
      }
      filter.where[relation.keyTo] = {
        inq: uniq(allTargetIds),
      };
      relation.applyScope(null, filter);
      /**
       * Make the DB Call, fetch all target objects
       */
      findWithForeignKeysByPage(relation.modelTo, filter,
        relation.keyTo, 0, options, targetFetchHandler);
      /**
       * Handle the fetched target objects
       * @param err
       * @param {Array<Model>}targets
       * @returns {*}
       */
      function targetFetchHandler(err, targets) {
        if (err) {
          return callback(err);
        }
        const tasks = [];
        // simultaneously process subIncludes
        if (subInclude && targets) {
          tasks.push(function subIncludesTask(next) {
            relation.modelTo.include(targets, subInclude, options, next);
          });
        }
        targets = utils.sortObjectsByIds(modelToIdName, allTargetIds, targets);
        // process each target object
        tasks.push(targetLinkingTask);
        function targetLinkingTask(next) {
          async.each(targets, linkManyToMany, next);
          function linkManyToMany(target, next) {
            const objList = targetObjsMap[target[relation.keyTo].toString()];
            async.each(objList, function(obj, next) {
              if (!obj) return next();
              obj.__cachedRelations[relationName].push(target);
              processTargetObj(obj, next);
            }, next);
          }
        }

        execTasksWithInterLeave(tasks, callback);
      }
    }

    /**
     * Handle inclusion of HasMany relation
     * @param callback
     */
    function includeHasManySimple(callback) {
      // Map for Indexing objects by their id for faster retrieval
      const objIdMap2 = includeUtils.buildOneToOneIdentityMapWithOrigKeys(objs, relation.keyFrom);

      filter.where[relation.keyTo] = {
        inq: uniq(objIdMap2.getKeys()),
      };

      relation.applyScope(null, filter);

      findWithForeignKeysByPage(relation.modelTo, filter,
        relation.keyTo, 0, options, targetFetchHandler);

      function targetFetchHandler(err, targets) {
        if (err) {
          return callback(err);
        }
        const targetsIdMap = includeUtils.buildOneToManyIdentityMapWithOrigKeys(targets, relation.keyTo);
        includeUtils.join(objIdMap2, targetsIdMap, function(obj1, valueToMergeIn) {
          defineCachedRelations(obj1);
          obj1.__cachedRelations[relationName] = valueToMergeIn;
          processTargetObj(obj1, function() {});
        });
        callback(err, objs);
      }
    }

    /**
     * Handle inclusion of HasMany relation
     * @param callback
     */
    function includeHasMany(callback) {
      const sourceIds = [];
      // Map for Indexing objects by their id for faster retrieval
      const objIdMap = {};
      for (let i = 0; i < objs.length; i++) {
        const obj = objs[i];
        // one-to-many: foreign key reference is modelTo -> modelFrom.
        // use modelFrom.keyFrom in where filter later
        const sourceId = obj[relation.keyFrom];
        if (sourceId) {
          sourceIds.push(sourceId);
          objIdMap[sourceId.toString()] = obj;
        }
        // sourceId can be null. but cache empty data as result
        defineCachedRelations(obj);
        obj.__cachedRelations[relationName] = [];
      }
      filter.where[relation.keyTo] = {
        inq: uniq(sourceIds),
      };
      relation.applyScope(null, filter);
      options.partitionBy = relation.keyTo;

      findWithForeignKeysByPage(relation.modelTo, filter,
        relation.keyTo, 0, options, targetFetchHandler);

      /**
       * Process fetched related objects
       * @param err
       * @param {Array<Model>} targets
       * @returns {*}
       */
      function targetFetchHandler(err, targets) {
        if (err) {
          return callback(err);
        }
        const tasks = [];
        // simultaneously process subIncludes
        if (subInclude && targets) {
          tasks.push(function subIncludesTask(next) {
            relation.modelTo.include(targets, subInclude, options, next);
          });
        }
        // process each target object
        tasks.push(targetLinkingTask);
        function targetLinkingTask(next) {
          if (targets.length === 0) {
            return async.each(objs, function(obj, next) {
              processTargetObj(obj, next);
            }, next);
          }

          async.each(targets, linkManyToOne, next);
          function linkManyToOne(target, next) {
            // fix for bug in hasMany with referencesMany
            const targetIds = [].concat(target[relation.keyTo]);
            async.each(targetIds, function(targetId, next) {
              const obj = objIdMap[targetId.toString()];
              if (!obj) return next();
              obj.__cachedRelations[relationName].push(target);
              processTargetObj(obj, next);
            }, function(err, processedTargets) {
              if (err) {
                return next(err);
              }

              const objsWithEmptyRelation = objs.filter(function(obj) {
                return obj.__cachedRelations[relationName].length === 0;
              });
              async.each(objsWithEmptyRelation, function(obj, next) {
                processTargetObj(obj, next);
              }, function(err) {
                next(err, processedTargets);
              });
            });
          }
        }

        execTasksWithInterLeave(tasks, callback);
      }
    }

    /**
     * Handle Inclusion of Polymorphic BelongsTo relation
     * @param callback
     */
    function includePolymorphicBelongsTo(callback) {
      const targetIdsByType = {};
      // Map for Indexing objects by their type and targetId for faster retrieval
      const targetObjMapByType = {};
      for (let i = 0; i < objs.length; i++) {
        const obj = objs[i];
        const discriminator = polymorphic.discriminator;
        const modelType = obj[discriminator];
        if (modelType) {
          targetIdsByType[modelType] = targetIdsByType[modelType] || [];
          targetObjMapByType[modelType] = targetObjMapByType[modelType] || {};
          const targetIds = targetIdsByType[modelType];
          const targetObjsMap = targetObjMapByType[modelType];
          const targetId = obj[relation.keyFrom];
          if (targetId) {
            targetIds.push(targetId);
            const targetIdStr = targetId.toString();
            targetObjsMap[targetIdStr] = targetObjsMap[targetIdStr] || [];
            // Is belongsTo. Multiple objects can have the same
            // targetId and therefore map value is an array
            targetObjsMap[targetIdStr].push(obj);
          }
        }
        defineCachedRelations(obj);
        obj.__cachedRelations[relationName] = null;
      }
      async.each(Object.keys(targetIdsByType), processPolymorphicType,
        callback);
      /**
       * Process Polymorphic objects of each type (modelType)
       * @param {String} modelType
       * @param callback
       */
      function processPolymorphicType(modelType, callback) {
        const typeFilter = {where: {}};
        utils.mergeQuery(typeFilter, filter);
        const targetIds = targetIdsByType[modelType];
        typeFilter.where[relation.keyTo] = {
          inq: uniq(targetIds),
        };
        const Model = lookupModel(relation.modelFrom.dataSource.modelBuilder.
          models, modelType);
        if (!Model) {
          callback(new Error(g.f('Discriminator type %s specified but no model exists with such name',
            modelType)));
          return;
        }
        relation.applyScope(null, typeFilter);

        findWithForeignKeysByPage(Model, typeFilter,
          relation.keyTo, 0, options, targetFetchHandler);

        /**
         * Process fetched related objects
         * @param err
         * @param {Array<Model>} targets
         * @returns {*}
         */
        function targetFetchHandler(err, targets) {
          if (err) {
            return callback(err);
          }
          const tasks = [];

          // simultaneously process subIncludes
          if (subInclude && targets) {
            tasks.push(function subIncludesTask(next) {
              Model.include(targets, subInclude, options, next);
            });
          }
          // process each target object
          tasks.push(targetLinkingTask);
          function targetLinkingTask(next) {
            const targetObjsMap = targetObjMapByType[modelType];
            async.each(targets, linkOneToMany, next);
            function linkOneToMany(target, next) {
              const objList = targetObjsMap[target[relation.keyTo].toString()];
              async.each(objList, function(obj, next) {
                if (!obj) return next();
                obj.__cachedRelations[relationName] = target;
                processTargetObj(obj, next);
              }, next);
            }
          }

          execTasksWithInterLeave(tasks, callback);
        }
      }
    }

    /**
     * Handle Inclusion of Polymorphic HasOne relation
     * @param callback
     */
    function includePolymorphicHasOne(callback) {
      const sourceIds = [];
      // Map for Indexing objects by their id for faster retrieval
      const objIdMap = {};
      for (let i = 0; i < objs.length; i++) {
        const obj = objs[i];
        // one-to-one: foreign key reference is modelTo -> modelFrom.
        // use modelFrom.keyFrom in where filter later
        const sourceId = obj[relation.keyFrom];
        if (sourceId) {
          sourceIds.push(sourceId);
          objIdMap[sourceId.toString()] = obj;
        }
        // sourceId can be null. but cache empty data as result
        defineCachedRelations(obj);
        obj.__cachedRelations[relationName] = null;
      }
      filter.where[relation.keyTo] = {
        inq: uniq(sourceIds),
      };
      relation.applyScope(null, filter);

      findWithForeignKeysByPage(relation.modelTo, filter,
        relation.keyTo, 0, options, targetFetchHandler);

      /**
       * Process fetched related objects
       * @param err
       * @param {Array<Model>} targets
       * @returns {*}
       */
      function targetFetchHandler(err, targets) {
        if (err) {
          return callback(err);
        }
        const tasks = [];
        // simultaneously process subIncludes
        if (subInclude && targets) {
          tasks.push(function subIncludesTask(next) {
            relation.modelTo.include(targets, subInclude, options, next);
          });
        }
        // process each target object
        tasks.push(targetLinkingTask);
        function targetLinkingTask(next) {
          async.each(targets, linkOneToOne, next);
          function linkOneToOne(target, next) {
            const sourceId = target[relation.keyTo];
            if (!sourceId) return next();
            const obj = objIdMap[sourceId.toString()];
            if (!obj) return next();
            obj.__cachedRelations[relationName] = target;
            processTargetObj(obj, next);
          }
        }

        execTasksWithInterLeave(tasks, callback);
      }
    }

    /**
     * Handle Inclusion of BelongsTo/HasOne relation
     * @param callback
     */
    function includeOneToOne(callback) {
      const targetIds = [];
      const objTargetIdMap = {};
      for (let i = 0; i < objs.length; i++) {
        const obj = objs[i];
        if (relation.type === 'belongsTo') {
          if (obj[relation.keyFrom] == null) {
            defineCachedRelations(obj);
            obj.__cachedRelations[relationName] = null;
            debug('ID property "%s" is missing in item %j', relation.keyFrom, obj);
            continue;
          }
        }
        const targetId = obj[relation.keyFrom];
        if (targetId) {
          targetIds.push(targetId);
          const targetIdStr = targetId.toString();
          objTargetIdMap[targetIdStr] = objTargetIdMap[targetIdStr] || [];
          objTargetIdMap[targetIdStr].push(obj);
        } else {
          debug('ID property "%s" is missing in item %j', relation.keyFrom, obj);
        }
        defineCachedRelations(obj);
        obj.__cachedRelations[relationName] = null;
      }
      filter.where[relation.keyTo] = {
        inq: uniq(targetIds),
      };
      relation.applyScope(null, filter);

      findWithForeignKeysByPage(relation.modelTo, filter,
        relation.keyTo, 0, options, targetFetchHandler);

      /**
       * Process fetched related objects
       * @param err
       * @param {Array<Model>} targets
       * @returns {*}
       */
      function targetFetchHandler(err, targets) {
        if (err) {
          return callback(err);
        }
        const tasks = [];
        // simultaneously process subIncludes
        if (subInclude && targets) {
          tasks.push(function subIncludesTask(next) {
            relation.modelTo.include(targets, subInclude, options, next);
          });
        }
        // process each target object
        tasks.push(targetLinkingTask);
        function targetLinkingTask(next) {
          async.each(targets, linkOneToMany, next);
          function linkOneToMany(target, next) {
            const targetId = target[relation.keyTo];
            const objList = objTargetIdMap[targetId.toString()];
            async.each(objList, function(obj, next) {
              if (!obj) return next();
              obj.__cachedRelations[relationName] = target;
              processTargetObj(obj, next);
            }, next);
          }
        }

        execTasksWithInterLeave(tasks, callback);
      }
    }

    /**
     * Handle Inclusion of EmbedsMany/EmbedsManyWithBelongsTo/EmbedsOne
     * Relations. Since Embedded docs are part of parents, no need to make
     * db calls. Let the related function be called for each object to fetch
     * the results from cache.
     *
     * TODO: Optimize EmbedsManyWithBelongsTo relation DB Calls
     * @param callback
     */
    function includeEmbeds(callback) {
      async.each(objs, function(obj, next) {
        processTargetObj(obj, next);
      }, callback);
    }

    /**
     * Process Each Model Object and make sure specified relations are included
     * @param {Model} obj - Single Mode object for which inclusion is needed
     * @param callback
     * @returns {*}
     */
    function processTargetObj(obj, callback) {
      const isInst = obj instanceof self;

      // Calling the relation method on the instance
      if (relation.type === 'belongsTo') {
        // If the belongsTo relation doesn't have an owner
        if (obj[relation.keyFrom] === null || obj[relation.keyFrom] === undefined) {
          defineCachedRelations(obj);
          // Set to null if the owner doesn't exist
          obj.__cachedRelations[relationName] = null;
          if (isInst) {
            obj.__data[relationName] = null;
          } else {
            obj[relationName] = null;
          }
          return callback();
        }
      }
      /**
       * Sets the related objects as a property of Parent Object
       * @param {Array<Model>|Model|null} result - Related Object/Objects
       * @param cb
       */
      function setIncludeData(result, cb) {
        if (isInst) {
          if (Array.isArray(result) && !(result instanceof List)) {
            result = new List(result, relation.modelTo);
          }
          obj.__data[relationName] = result;
          // obj.setStrict(false); issue #1252
        } else {
          obj[relationName] = result;
        }
        cb(null, result);
      }

      // obj.__cachedRelations[relationName] can be null if no data was returned
      if (obj.__cachedRelations &&
        obj.__cachedRelations[relationName] !== undefined) {
        return setIncludeData(obj.__cachedRelations[relationName],
          callback);
      }

      const inst = (obj instanceof self) ? obj : new self(obj);

      // If related objects are not cached by include Handlers, directly call
      // related accessor function even though it is not very efficient
      let related; // relation accessor function

      if ((relation.multiple || relation.type === 'belongsTo') && scope) {
        const includeScope = {};
        const filter = scope.conditions();

        // make sure not to miss any fields for sub includes
        if (filter.fields && Array.isArray(subInclude) && relation.modelTo.relations) {
          includeScope.fields = [];
          subInclude.forEach(function(name) {
            const rel = relation.modelTo.relations[name];
            if (rel && rel.type === 'belongsTo') {
              includeScope.fields.push(rel.keyFrom);
            }
          });
        }

        utils.mergeQuery(filter, includeScope, {fields: false});

        related = inst[relationName].bind(inst, filter);
      } else {
        related = inst[relationName].bind(inst, undefined);
      }

      related(options, function(err, result) {
        if (err) {
          return callback(err);
        } else {
          defineCachedRelations(obj);
          obj.__cachedRelations[relationName] = result;

          return setIncludeData(result, callback);
        }
      });
    }
  }
};
