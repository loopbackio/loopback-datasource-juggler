var async = require('async');
var utils = require('./utils');
var isPlainObject = utils.isPlainObject;
var defineCachedRelations = utils.defineCachedRelations;

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
 * @param {String}, {Object} or {Array} include Which relations to load.
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


  /*!
   * Normalize the include to be an array
   * @param include
   * @returns {*}
   */
  function normalizeInclude(include) {
    if (typeof include === 'string') {
      return [include];
    } else if (isPlainObject(include)) {
      // Build an array of key/value pairs
      var newInclude = [];
      for (var key in include) {
        var obj = {};
        obj[key] = include[key];
        newInclude.push(obj);
      }
      return newInclude;
    } else {
      return include;
    }
  }

  function processIncludeItem(objs, include, cb) {
    var relations = self.relations;

    var relationName, subInclude;
    if (isPlainObject(include)) {
      relationName = Object.keys(include)[0];
      subInclude = include[relationName];
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
      inst[relationName](function (err, result) {
        if (err) {
          return callback(err);
        } else {
          defineCachedRelations(obj);
          obj.__cachedRelations[relationName] = result;
          if(obj === inst) {
            obj.__data[relationName] = result;
            obj.strict = false;
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

