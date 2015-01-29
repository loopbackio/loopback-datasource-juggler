var async = require('async');
var utils = require('./utils');
var isPlainObject = utils.isPlainObject;
var defineCachedRelations = utils.defineCachedRelations;

/*!
 * Normalize the include to be an array
 * @param include
 * @returns {*}
 */
function normalizeInclude(include) {
  var newInclude;
  if (typeof include === 'string') {
    return [include];
  } else if (isPlainObject(include)) {
    // Build an array of key/value pairs
    newInclude = [];
    var rel = include.rel || include.relation;
    var obj = {};
    if (typeof rel === 'string') {
      obj[rel] = new IncludeScope(include.scope);
      newInclude.push(obj);
    } else {
      for (var key in include) {
        obj[key] = include[key];
        newInclude.push(obj);
      }
    }
    return newInclude;
  } else if (Array.isArray(include)) {
    newInclude = [];
    for (var i = 0, n = include.length; i < n; i++) {
      var subIncludes = normalizeInclude(include[i]);
      newInclude = newInclude.concat(subIncludes);
    }
    return newInclude;
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
};

IncludeScope.prototype.conditions = function() {
  return utils.deepMerge({}, this._scope);
};

IncludeScope.prototype.include = function() {
  return this._include;
};

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
 * @param {Function} cb Callback called when relations are loaded
 * 
 */
Inclusion.include = function (objects, include, cb) {
  var self = this;
  
  if (!include || (Array.isArray(include) && include.length === 0) ||
      (isPlainObject(include) && Object.keys(include).length === 0)) {
    // The objects are empty
    return process.nextTick(function() {
      cb && cb(null, objects);
    });
  }

  include = normalizeInclude(include);
  
  async.each(include, function(item, callback) {
    processIncludeItem(objects, item, callback);
  }, function(err) {
    cb && cb(err, objects);
  });

  function processIncludeItem(objs, include, cb) {
    var relations = self.relations;
    
    var relationName;
    var subInclude = null, scope = null;
    
    if (isPlainObject(include)) {
      relationName = Object.keys(include)[0];
      if (include[relationName] instanceof IncludeScope) {
        scope = include[relationName];
        subInclude = scope.include();
      } else {
        subInclude = include[relationName];
      }
    } else {
      relationName = include;
      subInclude = null;
    }
    
    var relation = relations[relationName];
    if (!relation) {
      cb(new Error('Relation "' + relationName + '" is not defined for '
        + self.modelName + ' model'));
      return;
    }

    // Just skip if inclusion is disabled
    if (relation.options.disableInclude) {
      cb();
      return;
    }
    
    // Calling the relation method for each object
    async.each(objs, function (obj, callback) {
      if(relation.type === 'belongsTo') {
        // If the belongsTo relation doesn't have an owner
        if(obj[relation.keyFrom] === null || obj[relation.keyFrom] === undefined) {
          defineCachedRelations(obj);
          // Set to null if the owner doesn't exist
          obj.__cachedRelations[relationName] = null;
          if(obj === inst) {
            obj.__data[relationName] = null;
          } else {
            obj[relationName] = null;
          }
          return callback();
        }
      }
      
      var inst = (obj instanceof self) ? obj : new self(obj);
      // Calling the relation method on the instance
      
      var related; // relation accessor function
      
      if ((relation.multiple || relation.type === 'belongsTo') && scope) {
        var includeScope = {};
        var filter = scope.conditions();
        
        // make sure not to miss any fields for sub includes
        if (filter.fields && Array.isArray(subInclude) && relation.modelTo.relations) {
          includeScope.fields = [];
          subInclude.forEach(function(name) {
            var rel = relation.modelTo.relations[name];
            if (rel && rel.type === 'belongsTo') {
              includeScope.fields.push(rel.keyFrom);
            }
          });
        }
        
        utils.mergeQuery(filter, includeScope, {fields: false});
        
        related = inst[relationName].bind(inst, filter);
      } else {
        related = inst[relationName].bind(inst);
      }
      
      related(function (err, result) {
        if (err) {
          return callback(err);
        } else {
          
          defineCachedRelations(obj);
          obj.__cachedRelations[relationName] = result;
          
          if(obj === inst) {
            obj.__data[relationName] = result;
            obj.setStrict(false);
          } else {
            obj[relationName] = result;
          }
          
          if (subInclude && result) {
            var subItems = relation.multiple ? result : [result];
            // Recursively include the related models
            relation.modelTo.include(subItems, subInclude, callback);
          } else {
            callback(null, result);
          }
        }
      });
    }, cb);

  }
};

