/*!
 * Dependencies
 */
var i8n = require('inflection');
var defineScope = require('./scope.js').defineScope;
var ModelBaseClass = require('./model.js');

module.exports = Relation;

/**
 * Relations class.  Use to define relationships between models.
 *
 * @class Relation
 */
function Relation() {
}

/**
 * Find the relation by foreign key
 * @param {*} foreignKey The foreign key
 * @returns {Object} The relation object
 */
Relation.relationNameFor = function relationNameFor(foreignKey) {
  for (var rel in this.relations) {
    if (this.relations[rel].type === 'belongsTo' && this.relations[rel].keyFrom === foreignKey) {
      return rel;
    }
  }
};

/*!
 * Look up a model by name from the list of given models
 * @param {Object} models Models keyed by name
 * @param {String} modelName The model name
 * @returns {*} The matching model class
 */
function lookupModel(models, modelName) {
  if(models[modelName]) {
    return models[modelName];
  }
  var lookupClassName = modelName.toLowerCase();
  for (var name in models) {
    if (name.toLowerCase() === lookupClassName) {
      return models[name];
    }
  }
}

/**
 * Define a "one to many" relationship by specifying the model name
 * 
 * Examples:
 * ```
 * User.hasMany(Post, {as: 'posts', foreignKey: 'authorId'});
 * ```
 * 
 * ```
 * Book.hasMany(Chapter);
 * ```
 * Or, equivalently:
 * ```
 * Book.hasMany('chapters', {model: Chapter});
 * ```
 *
 * Query and create related models:
 *
 * ```js
 * Book.create(function(err, book) {
 * 
 *   // Create a chapter instance ready to be saved in the data source.
 *   var chapter = book.chapters.build({name: 'Chapter 1'});
 * 
 *   // Save the new chapter
 *   chapter.save();
 * 
 *  // you can also call the Chapter.create method with the `chapters` property which will build a chapter
 *  // instance and save the it in the data source.
 *  book.chapters.create({name: 'Chapter 2'}, function(err, savedChapter) {
 *  // this callback is optional
 *  });
 * 
 *   // Query chapters for the book  
 *   book.chapters(function(err, chapters) {  // all chapters with bookId = book.id 
 *     console.log(chapters);
 *   });
 * 
 *   book.chapters({where: {name: 'test'}, function(err, chapters) {
 *    // All chapters with bookId = book.id and name = 'test'
 *     console.log(chapters);
 *   });
 * });
 *```
 * @param {Object|String} anotherClass Model object (or String name of model) to which you are creating the relationship.
 * @options {Object} parameters Configuration parameters; see below. 
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Property name of foreign key field.
 * @property {Object} model Model object
 */
Relation.hasMany = function hasMany(anotherClass, params) {
  var thisClassName = this.modelName;
  params = params || {};
  if (typeof anotherClass === 'string') {
    params.as = anotherClass;
    if (params.model) {
      anotherClass = params.model;
    } else {
      var anotherClassName = i8n.singularize(anotherClass).toLowerCase();
      anotherClass = lookupModel(this.dataSource.modelBuilder.models, anotherClassName);
    }
  }
  var methodName = params.as || i8n.camelize(anotherClass.pluralModelName, true);
  var fk = params.foreignKey || i8n.camelize(thisClassName + '_id', true);

  var idName = this.dataSource.idName(this.modelName) || 'id';

  this.relations[methodName] = {
    type: 'hasMany',
    keyFrom: idName,
    keyTo: fk,
    modelTo: anotherClass,
    multiple: true
  };

  if (params.through) {
    this.relations[methodName].modelThrough = params.through;
  }
  // each instance of this class should have method named
  // pluralize(anotherClass.modelName)
  // which is actually just anotherClass.find({where: {thisModelNameId: this[idName]}}, cb);
  var scopeMethods = {
    findById: findById,
    destroy: destroyById
  };
  if (params.through) {
    var fk2 = i8n.camelize(anotherClass.modelName + '_id', true);

    // Create an instance of the target model and connect it to the instance of
    // the source model by creating an instance of the through model
    scopeMethods.create = function create(data, done) {
      if (typeof data !== 'object') {
        done = data;
        data = {};
      }
      if ('function' !== typeof done) {
        done = function () {
        };
      }
      var self = this;
      // First create the target model
      anotherClass.create(data, function (err, ac) {
        if (err) return done(err, ac);
        var d = {};
        d[params.through.relationNameFor(fk)] = self;
        d[params.through.relationNameFor(fk2)] = ac;
        // Then create the through model
        params.through.create(d, function (e) {
          if (e) {
            // Undo creation of the target model
            ac.destroy(function () {
              done(e);
            });
          } else {
            done(err, ac);
          }
        });
      });
    };

    /*!
     * Add the target model instance to the 'hasMany' relation
     * @param {Object|ID} acInst The actual instance or id value
     */
    scopeMethods.add = function (acInst, done) {
      var data = {};
      var query = {};
      query[fk] = this[idName];
      data[params.through.relationNameFor(fk)] = this;
      query[fk2] = acInst[idName] || acInst;
      data[params.through.relationNameFor(fk2)] = acInst;
      // Create an instance of the through model
      params.through.findOrCreate({where: query}, data, done);
    };

    /*!
     * Remove the target model instance from the 'hasMany' relation
     * @param {Object|ID) acInst The actual instance or id value
     */
    scopeMethods.remove = function (acInst, done) {
      var q = {};
      q[fk2] = acInst[idName] || acInst;
      params.through.findOne({where: q}, function (err, d) {
        if (err) {
          return done(err);
        }
        if (!d) {
          return done();
        }
        d.destroy(done);
      });
    };

    // No destroy method will be injected
    delete scopeMethods.destroy;
  }

  // Mix the property and scoped methods into the prototype class
  defineScope(this.prototype, params.through || anotherClass, methodName, function () {
    var filter = {};
    filter.where = {};
    filter.where[fk] = this[idName];
    if (params.through) {
      filter.collect = i8n.camelize(anotherClass.modelName, true);
      filter.include = filter.collect;
    }
    return filter;
  }, scopeMethods);

  if (!params.through) {
    // obviously, anotherClass should have attribute called `fk`
    anotherClass.dataSource.defineForeignKey(anotherClass.modelName, fk, this.modelName);
  }

  // Find the target model instance by id
  function findById(id, cb) {
    anotherClass.findById(id, function (err, inst) {
      if (err) {
        return cb(err);
      }
      if (!inst) {
        return cb(new Error('Not found'));
      }
      // Check if the foreign key matches the primary key
      if (inst[fk] && inst[fk].toString() === this[idName].toString()) {
        cb(null, inst);
      } else {
        cb(new Error('Permission denied'));
      }
    }.bind(this));
  }

  // Destroy the target model instance by id
  function destroyById(id, cb) {
    var self = this;
    anotherClass.findById(id, function (err, inst) {
      if (err) {
        return cb(err);
      }
      if (!inst) {
        return cb(new Error('Not found'));
      }
      // Check if the foreign key matches the primary key
      if (inst[fk] && inst[fk].toString() === self[idName].toString()) {
        inst.destroy(cb);
      } else {
        cb(new Error('Permission denied'));
      }
    });
  }

};

/**
 * Declare "belongsTo" relation that sets up a one-to-one connection with another model, such that each
 * instance of the declaring model "belongs to" one instance of the other model.
 *
 * For example, if an application includes users and posts, and each post can be written by exactly one user.
 * The following code specifies that `Post` has a reference called `author` to the `User` model via the `userId` property of `Post`
 * as the foreign key.
 * ```
 * Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
 * ```
 * You can then access the author in one of the following styles.
 * Get the User object for the post author asynchronously:
 * ```
 * post.author(callback);
 * ```
 * Get the User object for the post author synchronously:
 * ```
 * post.author();
 * Set the author to be the given user:
 * ```
 * post.author(user) 
 * ```
 * Examples:
 * 
 * Suppose the model Post has a *belongsTo* relationship with User (the author of the post). You could declare it this way:
 * ```js
 * Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
 * ```
 *
 * When a post is loaded, you can load the related author with:
 * ```js
 * post.author(function(err, user) {
 *     // the user variable is your user object
 * });
 * ```
 *
 * The related object is cached, so if later you try to get again the author, no additional request will be made.
 * But there is an optional boolean parameter in first position that set whether or not you want to reload the cache:
 * ```js
 * post.author(true, function(err, user) {
 *     // The user is reloaded, even if it was already cached.
 * });
 * ```
 * This optional parameter default value is false, so the related object will be loaded from cache if available.
 * 
 * @param {Class|String} anotherClass Model object (or String name of model) to which you are creating the relationship.
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Name of foreign key property.
 * 
 */
Relation.belongsTo = function (anotherClass, params) {
  params = params || {};
  if ('string' === typeof anotherClass) {
    params.as = anotherClass;
    if (params.model) {
      anotherClass = params.model;
    } else {
      var anotherClassName = anotherClass.toLowerCase();
      anotherClass = lookupModel(this.dataSource.modelBuilder.models, anotherClassName);
    }
  }

  var idName = this.dataSource.idName(anotherClass.modelName) || 'id';
  var methodName = params.as || i8n.camelize(anotherClass.modelName, true);
  var fk = params.foreignKey || methodName + 'Id';

  this.relations[methodName] = {
    type: 'belongsTo',
    keyFrom: fk,
    keyTo: idName,
    modelTo: anotherClass,
    multiple: false
  };

  this.dataSource.defineForeignKey(this.modelName, fk, anotherClass.modelName);
  this.prototype.__finders__ = this.prototype.__finders__ || {};

  // Set up a finder to find by id and make sure the foreign key of the declaring
  // model matches the primary key of the target model
  this.prototype.__finders__[methodName] = function (id, cb) {
    if (id === null) {
      cb(null, null);
      return;
    }
    anotherClass.findById(id, function (err, inst) {
      if (err) {
        return cb(err);
      }
      if (!inst) {
        return cb(null, null);
      }
      // Check if the foreign key matches the primary key
      if (inst[idName] === this[fk]) {
        cb(null, inst);
      } else {
        cb(new Error('Permission denied'));
      }
    }.bind(this));
  };

  // Define the method for the belongsTo relation itself
  // It will support one of the following styles:
  // - order.customer(refresh, callback): Load the target model instance asynchronously
  // - order.customer(customer): Synchronous setter of the target model instance
  // - order.customer(): Synchronous getter of the target model instance
  var relationMethod = function (refresh, p) {
    if (arguments.length === 1) {
      p = refresh;
      refresh = false;
    } else if (arguments.length > 2) {
      throw new Error('Method can\'t be called with more than two arguments');
    }
    var self = this;
    var cachedValue;
    if (!refresh && this.__cachedRelations && (this.__cachedRelations[methodName] !== undefined)) {
      cachedValue = this.__cachedRelations[methodName];
    }
    if (p instanceof ModelBaseClass) { // acts as setter
      this[fk] = p[idName];
      this.__cachedRelations[methodName] = p;
    } else if (typeof p === 'function') { // acts as async getter
      if (typeof cachedValue === 'undefined') {
        this.__finders__[methodName].apply(self, [this[fk], function (err, inst) {
          if (!err) {
            self.__cachedRelations[methodName] = inst;
          }
          p(err, inst);
        }]);
        return this[fk];
      } else {
        p(null, cachedValue);
        return cachedValue;
      }
    } else if (typeof p === 'undefined') { // acts as sync getter
      return this[fk];
    } else { // setter
      this[fk] = p;
      delete this.__cachedRelations[methodName];
    }
  };

  // Define a property for the scope so that we have 'this' for the scoped methods
  Object.defineProperty(this.prototype, methodName, {
    enumerable: true,
    configurable: true,
    get: function () {
      var fn = function() {
        // Call the relation method on the declaring model instance
        return relationMethod.apply(this, arguments);
      }
      // Create an instance of the target model and set the foreign key of the
      // declaring model instance to the id of the target instance
      fn.create = function(targetModelData, cb) {
        var self = this;
        anotherClass.create(targetModelData, function(err, targetModel) {
          if(!err) {
            self[fk] = targetModel[idName];
            cb && cb(err, targetModel);
          } else {
            cb && cb(err);
          }
        });
      }.bind(this);

      // Build an instance of the target model
      fn.build = function(targetModelData) {
        return new anotherClass(targetModelData);
      }.bind(this);

      fn._targetClass = anotherClass.modelName;

      return fn;
    }});

  // Wrap the property into a function for remoting
  // so that it can be accessed as /api/<model>/<id>/<belongsToRelationName>
  // For example, /api/orders/1/customer
  var fn = function() {
    var f = this[methodName];
    f.apply(this, arguments);
  };

  fn.shared = true;
  fn.http = {verb: 'get', path: '/' + methodName};
  fn.accepts = {arg: 'refresh', type: 'boolean', http: {source: 'query'}};
  fn.description = 'Fetches belongsTo relation ' + methodName;
  fn.returns = {arg: methodName, type: 'object', root: true};

  this.prototype['__get__' + methodName] = fn;
};

/**
 * A hasAndBelongsToMany relation creates a direct many-to-many connection with another model, with no intervening model.
 * For example, if your application includes users and groups, with each group having many users and each user appearing
 * in many groups, you could declare the models this way:
 * ```
 *  User.hasAndBelongsToMany('groups', {model: Group, foreignKey: 'groupId'});
 * ```
 *  Then, to get the groups to which the user belongs:
 * ```
 *  user.groups(callback);
 * ```
 *  Create a new group and connect it with the user:
 * ```
 *  user.groups.create(data, callback);
 * ```
 *  Connect an existing group with the user:
 * ```
 *  user.groups.add(group, callback);
 * ```
 *  Remove the user from the group:
 * ```
 *  user.groups.remove(group, callback); 
 * ```
 * 
 * @param {String|Object} anotherClass Model object (or String name of model) to which you are creating the relationship.
 * the relation
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Property name of foreign key field.
 * @property {Object} model Model object
 */
Relation.hasAndBelongsToMany = function hasAndBelongsToMany(anotherClass, params) {
  params = params || {};
  var models = this.dataSource.modelBuilder.models;

  if ('string' === typeof anotherClass) {
    params.as = anotherClass;
    if (params.model) {
      anotherClass = params.model;
    } else {
      anotherClass = lookupModel(models, i8n.singularize(anotherClass).toLowerCase()) ||
        anotherClass;
    }
    if (typeof anotherClass === 'string') {
      throw new Error('Could not find "' + anotherClass + '" relation for ' + this.modelName);
    }
  }

  if (!params.through) {
    var name1 = this.modelName + anotherClass.modelName;
    var name2 = anotherClass.modelName + this.modelName;
    params.through = lookupModel(models, name1) || lookupModel(models, name2) ||
      this.dataSource.define(name1);
  }
  params.through.belongsTo(this);
  params.through.belongsTo(anotherClass);

  this.hasMany(anotherClass, {as: params.as, through: params.through});

};
