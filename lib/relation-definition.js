/*!
 * Dependencies
 */
var assert = require('assert');
var util = require('util');
var i8n = require('inflection');
var defineScope = require('./scope.js').defineScope;
var mergeQuery = require('./scope.js').mergeQuery;
var ModelBaseClass = require('./model.js');

exports.Relation = Relation;
exports.RelationDefinition = RelationDefinition;

var RelationTypes = {
  belongsTo: 'belongsTo',
  hasMany: 'hasMany',
  hasOne: 'hasOne',
  hasAndBelongsToMany: 'hasAndBelongsToMany'
};

exports.RelationTypes = RelationTypes;
exports.HasMany = HasMany;
exports.HasManyThrough = HasManyThrough;
exports.HasOne = HasOne;
exports.HasAndBelongsToMany = HasAndBelongsToMany;
exports.BelongsTo = BelongsTo;

var RelationClasses = {
  belongsTo: BelongsTo,
  hasMany: HasMany,
  hasManyThrough: HasManyThrough,
  hasOne: HasOne,
  hasAndBelongsToMany: HasAndBelongsToMany
};

function normalizeType(type) {
  if (!type) {
    return type;
  }
  var t1 = type.toLowerCase();
  for (var t2 in RelationTypes) {
    if (t2.toLowerCase() === t1) {
      return t2;
    }
  }
  return null;
}

/**
 * Relation definition class.  Use to define relationships between models.
 * @param {Object} definition
 * @class RelationDefinition
 */
function RelationDefinition(definition) {
  if (!(this instanceof RelationDefinition)) {
    return new RelationDefinition(definition);
  }
  definition = definition || {};
  this.name = definition.name;
  assert(this.name, 'Relation name is missing');
  this.type = normalizeType(definition.type);
  assert(this.type, 'Invalid relation type: ' + definition.type);
  this.modelFrom = definition.modelFrom;
  assert(this.modelFrom, 'Source model is required');
  this.keyFrom = definition.keyFrom;
  this.modelTo = definition.modelTo;
  assert(this.modelTo, 'Target model is required');
  this.keyTo = definition.keyTo;
  this.modelThrough = definition.modelThrough;
  this.keyThrough = definition.keyThrough;
  this.multiple = (this.type !== 'belongsTo' && this.type !== 'hasOne');
  this.properties = definition.properties || {};
  this.options = definition.options || {};
  this.scope = definition.scope;
}

RelationDefinition.prototype.toJSON = function () {
  var json = {
    name: this.name,
    type: this.type,
    modelFrom: this.modelFrom.modelName,
    keyFrom: this.keyFrom,
    modelTo: this.modelTo.modelName,
    keyTo: this.keyTo,
    multiple: this.multiple
  };
  if (this.modelThrough) {
    json.modelThrough = this.modelThrough.modelName;
    json.keyThrough = this.keyThrough;
  }
  return json;
};

/**
 * Apply the configured scope to the filter/query object.
 * @param {Object} modelInstance
 * @param {Object} filter (where, order, limit, fields, ...)
 */
RelationDefinition.prototype.applyScope = function(modelInstance, filter) {
  if (typeof this.scope === 'function') {
    var scope = this.scope.call(this, modelInstance, filter);
    if (typeof scope === 'object') {
      mergeQuery(filter, scope);
    }
  } else if (typeof this.scope === 'object') {
    mergeQuery(filter, this.scope);
  }
};

/**
 * Apply the configured properties to the target object.
 * @param {Object} modelInstance
 * @param {Object} target
 */
RelationDefinition.prototype.applyProperties = function(modelInstance, target) {
  if (typeof this.properties === 'function') {
    var data = this.properties.call(this, modelInstance);
    for(var k in data) {
      target[k] = data[k];
    }
  } else if (typeof this.properties === 'object') {
    for(var k in this.properties) {
      var key = this.properties[k];
      target[key] = modelInstance[k];
    }
  }
};

/**
 * A relation attaching to a given model instance
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {Relation}
 * @constructor
 * @class Relation
 */
function Relation(definition, modelInstance) {
  if (!(this instanceof Relation)) {
    return new Relation(definition, modelInstance);
  }
  if (!(definition instanceof RelationDefinition)) {
    definition = new RelationDefinition(definition);
  }
  this.definition = definition;
  this.modelInstance = modelInstance;
}

Relation.prototype.resetCache = function (cache) {
  cache = cache || undefined;
  this.modelInstance.__cachedRelations[this.definition.name] = cache;
};

Relation.prototype.getCache = function () {
  return this.modelInstance.__cachedRelations[this.definition.name];
};

/**
 * HasMany subclass
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {HasMany}
 * @constructor
 * @class HasMany
 */
function HasMany(definition, modelInstance) {
  if (!(this instanceof HasMany)) {
    return new HasMany(definition, modelInstance);
  }
  assert(definition.type === RelationTypes.hasMany);
  Relation.apply(this, arguments);
}

util.inherits(HasMany, Relation);

HasMany.prototype.removeFromCache = function (id) {
  var cache = this.modelInstance.__cachedRelations[this.definition.name];
  var idName = this.definition.modelTo.definition.idName();
  if (Array.isArray(cache)) {
    for (var i = 0, n = cache.length; i < n; i++) {
      if (cache[i][idName] === id) {
        return cache.splice(i, 1);
      }
    }
  }
  return null;
};

HasMany.prototype.addToCache = function (inst) {
  if (!inst) {
    return;
  }
  var cache = this.modelInstance.__cachedRelations[this.definition.name];
  if (cache === undefined) {
    cache = this.modelInstance.__cachedRelations[this.definition.name] = [];
  }
  var idName = this.definition.modelTo.definition.idName();
  if (Array.isArray(cache)) {
    for (var i = 0, n = cache.length; i < n; i++) {
      if (cache[i][idName] === inst[idName]) {
        cache[i] = inst;
        return;
      }
    }
    cache.push(inst);
  }
};

/**
 * HasManyThrough subclass
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {HasManyThrough}
 * @constructor
 * @class HasManyThrough
 */
function HasManyThrough(definition, modelInstance) {
  if (!(this instanceof HasManyThrough)) {
    return new HasManyThrough(definition, modelInstance);
  }
  assert(definition.type === RelationTypes.hasMany);
  assert(definition.modelThrough);
  HasMany.apply(this, arguments);
}

util.inherits(HasManyThrough, HasMany);

/**
 * BelongsTo subclass
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {BelongsTo}
 * @constructor
 * @class BelongsTo
 */
function BelongsTo(definition, modelInstance) {
  if (!(this instanceof BelongsTo)) {
    return new BelongsTo(definition, modelInstance);
  }
  assert(definition.type === RelationTypes.belongsTo);
  Relation.apply(this, arguments);
}

util.inherits(BelongsTo, Relation);

/**
 * HasAndBelongsToMany subclass
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {HasAndBelongsToMany}
 * @constructor
 * @class HasAndBelongsToMany
 */
function HasAndBelongsToMany(definition, modelInstance) {
  if (!(this instanceof HasAndBelongsToMany)) {
    return new HasAndBelongsToMany(definition, modelInstance);
  }
  assert(definition.type === RelationTypes.hasAndBelongsToMany);
  Relation.apply(this, arguments);
}

util.inherits(HasAndBelongsToMany, Relation);

/**
 * HasOne subclass
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {HasOne}
 * @constructor
 * @class HasOne
 */
function HasOne(definition, modelInstance) {
  if (!(this instanceof HasOne)) {
    return new HasOne(definition, modelInstance);
  }
  assert(definition.type === RelationTypes.hasOne);
  Relation.apply(this, arguments);
}

util.inherits(HasOne, Relation);


/*!
 * Find the relation by foreign key
 * @param {*} foreignKey The foreign key
 * @returns {Object} The relation object
 */
function findBelongsTo(modelFrom, modelTo, keyTo) {
  var relations = modelFrom.relations;
  var keys = Object.keys(relations);
  for (var k = 0; k < keys.length; k++) {
    var rel = relations[keys[k]];
    if (rel.type === RelationTypes.belongsTo &&
      rel.modelTo === modelTo &&
      (keyTo === undefined || rel.keyTo === keyTo)) {
      return rel.keyFrom;
    }
  }
  return null;
}

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
 * @param {Model} modelFrom Source model class
 * @param {Object|String} modelTo Model object (or String name of model) to which you are creating the relationship.
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Property name of foreign key field.
 * @property {Object} model Model object
 */
RelationDefinition.hasMany = function hasMany(modelFrom, modelTo, params) {
  var thisClassName = modelFrom.modelName;
  params = params || {};
  if (typeof modelTo === 'string') {
    params.as = modelTo;
    if (params.model) {
      modelTo = params.model;
    } else {
      var modelToName = i8n.singularize(modelTo).toLowerCase();
      modelTo = lookupModel(modelFrom.dataSource.modelBuilder.models, modelToName);
    }
  }
  var relationName = params.as || i8n.camelize(modelTo.pluralModelName, true);
  var fk = params.foreignKey || i8n.camelize(thisClassName + '_id', true);

  var idName = modelFrom.dataSource.idName(modelFrom.modelName) || 'id';
  
  var definition = new RelationDefinition({
    name: relationName,
    type: RelationTypes.hasMany,
    modelFrom: modelFrom,
    keyFrom: idName,
    keyTo: fk,
    modelTo: modelTo,
    multiple: true,
    properties: params.properties,
    scope: params.scope,
    options: params.options
  });
  
  if (params.through) {
    definition.modelThrough = params.through;
    var keyThrough = definition.throughKey || i8n.camelize(modelTo.modelName + '_id', true);
    definition.keyThrough = keyThrough;
  }

  modelFrom.relations[relationName] = definition;

  if (!params.through) {
    // obviously, modelTo should have attribute called `fk`
    modelTo.dataSource.defineForeignKey(modelTo.modelName, fk, modelFrom.modelName);
  }

  var scopeMethods = {
    findById: scopeMethod(definition, 'findById'),
    destroy: scopeMethod(definition, 'destroyById'),
    updateById: scopeMethod(definition, 'updateById'),
    exists: scopeMethod(definition, 'exists')
  };

  var findByIdFunc = scopeMethods.findById;
  modelFrom.prototype['__findById__' + relationName] = findByIdFunc;

  var destroyByIdFunc = scopeMethods.destroy;
  modelFrom.prototype['__destroyById__' + relationName] = destroyByIdFunc;

  var updateByIdFunc = scopeMethods.updateById;
  modelFrom.prototype['__updateById__' + relationName] = updateByIdFunc;

  if(definition.modelThrough) {
    scopeMethods.create = scopeMethod(definition, 'create');
    scopeMethods.add = scopeMethod(definition, 'add');
    scopeMethods.remove = scopeMethod(definition, 'remove');

    var addFunc = scopeMethods.add;
    modelFrom.prototype['__link__' + relationName] = addFunc;

    var removeFunc = scopeMethods.remove;
    modelFrom.prototype['__unlink__' + relationName] = removeFunc;
  } else {
    scopeMethods.create = scopeMethod(definition, 'create');
    scopeMethods.build = scopeMethod(definition, 'build');
  }
  
  // Mix the property and scoped methods into the prototype class
  defineScope(modelFrom.prototype, params.through || modelTo, relationName, function () {
    var filter = {};
    filter.where = {};
    filter.where[fk] = this[idName];
    
    definition.applyScope(this, filter);
    
    if (params.through) {
      filter.collect = i8n.camelize(modelTo.modelName, true);
      filter.include = filter.collect;
    }
    return filter;
  }, scopeMethods);

};

function scopeMethod(definition, methodName) {
  var relationClass = RelationClasses[definition.type];
  if (definition.type === RelationTypes.hasMany && definition.modelThrough) {
    relationClass = RelationClasses.hasManyThrough;
  }
  var method = function () {
    var relation = new relationClass(definition, this);
    return relation[methodName].apply(relation, arguments);
  };

  var relationMethod = relationClass.prototype[methodName];
  if (relationMethod.shared) {
    method.shared = true;
    method.accepts = relationMethod.accepts;
    method.returns = relationMethod.returns;
    method.http = relationMethod.http;
    method.description = relationMethod.description;
  }
  return method;
}

/**
 * Find a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Function} cb The callback function
 */
HasMany.prototype.findById = function (fkId, cb) {
  var modelTo = this.definition.modelTo;
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  var idName = this.definition.modelTo.definition.idName();
  var filter = {};
  filter.where = {};
  filter.where[idName] = fkId;
  filter.where[fk] = modelInstance[pk];
  
  this.definition.applyScope(modelInstance, filter);
  
  modelTo.findOne(filter, function (err, inst) {
    if (err) {
      return cb(err);
    }
    if (!inst) {
      err = new Error('No instance with id ' + fkId + ' found for ' + modelTo.modelName);
      err.statusCode = 404;
      return cb(err);
    }
    // Check if the foreign key matches the primary key
    if (inst[fk] && inst[fk].toString() === modelInstance[pk].toString()) {
      cb(null, inst);
    } else {
      err = new Error('Key mismatch: ' + this.definition.modelFrom.modelName + '.' + pk
        + ': ' + modelInstance[pk]
        + ', ' + modelTo.modelName + '.' + fk + ': ' + inst[fk]);
      err.statusCode = 400;
      cb(err);
    }
  });
};

/**
 * Find a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Function} cb The callback function
 */
HasMany.prototype.exists = function (fkId, cb) {
  var modelTo = this.definition.modelTo;
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  modelTo.findById(fkId, function (err, inst) {
    if (err) {
      return cb(err);
    }
    if (!inst) {
      return cb(null, false);
    }
    // Check if the foreign key matches the primary key
    if (inst[fk] && inst[fk].toString() === modelInstance[pk].toString()) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  });
};

/**
 * Update a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Function} cb The callback function
 */
HasMany.prototype.updateById = function (fkId, data, cb) {
  this.findById(fkId, function (err, inst) {
    if (err) {
      return cb && cb(err);
    }
    inst.updateAttributes(data, cb);
  });
};

/**
 * Delete a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Function} cb The callback function
 */
HasMany.prototype.destroyById = function (fkId, cb) {
  var self = this;
  this.findById(fkId, function(err, inst) {
    if (err) {
      return cb(err);
    }
    self.removeFromCache(inst[fkId]);
    inst.destroy(cb);
  });
};

/**
 * Find a related item by foreign key
 * @param {*} fkId The foreign key value
 * @param {Function} cb The callback function
 */
HasManyThrough.prototype.findById = function (fkId, cb) {
  var self = this;
  var modelTo = this.definition.modelTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;
  var modelThrough = this.definition.modelThrough;

  self.exists(fkId, function (err, exists) {
    if (err || !exists) {
      if (!err) {
        err = new Error('No relation found in ' + modelThrough.modelName
          + ' for (' + self.definition.modelFrom.modelName + '.' + modelInstance[pk]
          + ',' + modelTo.modelName + '.' + fkId + ')');
        err.statusCode = 404;
      }
      return cb(err);
    }
    modelTo.findById(fkId, function (err, inst) {
      if (err) {
        return cb(err);
      }
      if (!inst) {
        err = new Error('No instance with id ' + fkId + ' found for ' + modelTo.modelName);
        err.statusCode = 404;
        return cb(err);
      }
      cb(err, inst);
    });
  });
};

/**
 * Delete a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Function} cb The callback function
 */
HasManyThrough.prototype.destroyById = function (fkId, cb) {
  var self = this;
  var modelTo = this.definition.modelTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;
  var modelThrough = this.definition.modelThrough;

  self.exists(fkId, function (err, exists) {
    if (err || !exists) {
      if (!err) {
        err = new Error('No record found in ' + modelThrough.modelName
          + ' for (' + self.definition.modelFrom.modelName + '.' + modelInstance[pk]
          + ' ,' + modelTo.modelName + '.' + fkId + ')');
        err.statusCode = 404;
      }
      return cb(err);
    }
    self.remove(fkId, function(err) {
      if(err) {
        return cb(err);
      }
      modelTo.deleteById(fkId, cb);
    });
  });
};

// Create an instance of the target model and connect it to the instance of
// the source model by creating an instance of the through model
HasManyThrough.prototype.create = function create(data, done) {
  var self = this;
  var definition = this.definition;
  var modelTo = definition.modelTo;
  var modelThrough = definition.modelThrough;

  if (typeof data === 'function' && !done) {
    done = data;
    data = {};
  }

  var modelInstance = this.modelInstance;

  // First create the target model
  modelTo.create(data, function (err, to) {
    if (err) {
      return done && done(err, to);
    }
    // The primary key for the target model
    var pk2 = definition.modelTo.definition.idName();
    var fk1 = findBelongsTo(modelThrough, definition.modelFrom,
      definition.keyFrom);
    var fk2 = findBelongsTo(modelThrough, definition.modelTo, pk2);
    var d = {};
    d[fk1] = modelInstance[definition.keyFrom];
    d[fk2] = to[pk2];
    
    definition.applyProperties(modelInstance, d);
    
    // Then create the through model
    modelThrough.create(d, function (e, through) {
      if (e) {
        // Undo creation of the target model
        to.destroy(function () {
          done && done(e);
        });
      } else {
        self.addToCache(to);
        done && done(err, to);
      }
    });
  });
};

/**
 * Add the target model instance to the 'hasMany' relation
 * @param {Object|ID} acInst The actual instance or id value
 */
HasManyThrough.prototype.add = function (acInst, done) {
  var self = this;
  var definition = this.definition;
  var modelThrough = definition.modelThrough;
  var pk1 = definition.keyFrom;

  var data = {};
  var query = {};

  var fk1 = findBelongsTo(modelThrough, definition.modelFrom,
    definition.keyFrom);

  // The primary key for the target model
  var pk2 = definition.modelTo.definition.idName();

  var fk2 = findBelongsTo(modelThrough, definition.modelTo, pk2);
  
  query[fk1] = this.modelInstance[pk1];
  query[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;
  
  var filter = { where: query };
  
  definition.applyScope(this.modelInstance, filter);

  data[fk1] = this.modelInstance[pk1];
  data[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;
  definition.applyProperties(this.modelInstance, data);

  // Create an instance of the through model
  modelThrough.findOrCreate(filter, data, function(err, ac) {
    if(!err) {
      if (acInst instanceof definition.modelTo) {
        self.addToCache(acInst);
      }
    }
    done(err, ac);
  });
};

/**
 * Check if the target model instance is related to the 'hasMany' relation
 * @param {Object|ID} acInst The actual instance or id value
 */
HasManyThrough.prototype.exists = function (acInst, done) {
  var definition = this.definition;
  var modelThrough = definition.modelThrough;
  var pk1 = definition.keyFrom;

  var data = {};
  var query = {};

  var fk1 = findBelongsTo(modelThrough, definition.modelFrom,
    definition.keyFrom);

  // The primary key for the target model
  var pk2 = definition.modelTo.definition.idName();

  var fk2 = findBelongsTo(modelThrough, definition.modelTo, pk2);

  query[fk1] = this.modelInstance[pk1];

  query[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;

  data[fk1] = this.modelInstance[pk1];
  data[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;

  modelThrough.count(query, function(err, ac) {
    done(err, ac > 0);
  });
};

/**
 * Remove the target model instance from the 'hasMany' relation
 * @param {Object|ID) acInst The actual instance or id value
 */
HasManyThrough.prototype.remove = function (acInst, done) {
  var self = this;
  var definition = this.definition;
  var modelThrough = definition.modelThrough;
  var pk1 = definition.keyFrom;

  var query = {};

  var fk1 = findBelongsTo(modelThrough, definition.modelFrom,
    definition.keyFrom);

  // The primary key for the target model
  var pk2 = definition.modelTo.definition.idName();

  var fk2 = findBelongsTo(modelThrough, definition.modelTo, pk2);

  query[fk1] = this.modelInstance[pk1];
  query[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;
  
  var filter = { where: query };
  
  definition.applyScope(this.modelInstance, filter);

  modelThrough.deleteAll(filter.where, function (err) {
    if (!err) {
      self.removeFromCache(query[fk2]);
    }
    done(err);
  });
};


/**
 * Declare "belongsTo" relation that sets up a one-to-one connection with
 * another model, such that each instance of the declaring model "belongs to"
 * one instance of the other model.
 *
 * For example, if an application includes users and posts, and each post can
 * be written by exactly one user. The following code specifies that `Post` has
 * a reference called `author` to the `User` model via the `userId` property of
 * `Post` as the foreign key.
 * ```
 * Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
 * ```
 *
 * This optional parameter default value is false, so the related object will
 * be loaded from cache if available.
 * 
 * @param {Class|String} modelTo Model object (or String name of model) to
 * which you are creating the relationship.
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that
 * corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Name of foreign key property.
 * 
 */
RelationDefinition.belongsTo = function (modelFrom, modelTo, params) {
  params = params || {};
  if ('string' === typeof modelTo) {
    params.as = modelTo;
    if (params.model) {
      modelTo = params.model;
    } else {
      var modelToName = modelTo.toLowerCase();
      modelTo = lookupModel(modelFrom.dataSource.modelBuilder.models, modelToName);
    }
  }

  var idName = modelFrom.dataSource.idName(modelTo.modelName) || 'id';
  var relationName = params.as || i8n.camelize(modelTo.modelName, true);
  var fk = params.foreignKey || relationName + 'Id';
  
  var relationDef = modelFrom.relations[relationName] = new RelationDefinition({
    name: relationName,
    type: RelationTypes.belongsTo,
    modelFrom: modelFrom,
    keyFrom: fk,
    keyTo: idName,
    modelTo: modelTo,
    options: params.options
  });

  modelFrom.dataSource.defineForeignKey(modelFrom.modelName, fk, modelTo.modelName);

  // Define a property for the scope so that we have 'this' for the scoped methods
  Object.defineProperty(modelFrom.prototype, relationName, {
    enumerable: true,
    configurable: true,
    get: function() {
      var relation = new BelongsTo(relationDef, this);
      var relationMethod = relation.related.bind(relation);
      relationMethod.create = relation.create.bind(relation);
      relationMethod.build = relation.build.bind(relation);
      relationMethod._targetClass = relationDef.modelTo.modelName;
      return relationMethod;
    }
  });

  // FIXME: [rfeng] Wrap the property into a function for remoting
  // so that it can be accessed as /api/<model>/<id>/<belongsToRelationName>
  // For example, /api/orders/1/customer
  var fn = function() {
    var f = this[relationName];
    f.apply(this, arguments);
  };
  modelFrom.prototype['__get__' + relationName] = fn;
};

BelongsTo.prototype.create = function(targetModelData, cb) {
  var self = this;
  var modelTo = this.definition.modelTo;
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  if (typeof targetModelData === 'function' && !cb) {
    cb = targetModelData;
    targetModelData = {};
  }

  modelTo.create(targetModelData, function(err, targetModel) {
    if(!err) {
      modelInstance[fk] = targetModel[pk];
      self.resetCache(targetModel);
      cb && cb(err, targetModel);
    } else {
      cb && cb(err);
    }
  });
};

BelongsTo.prototype.build = function(targetModelData) {
  var modelTo = this.definition.modelTo;
  return new modelTo(targetModelData);
};

/**
 * Define the method for the belongsTo relation itself
 * It will support one of the following styles:
 * - order.customer(refresh, callback): Load the target model instance asynchronously
 * - order.customer(customer): Synchronous setter of the target model instance
 * - order.customer(): Synchronous getter of the target model instance
 *
 * @param refresh
 * @param params
 * @returns {*}
 */
BelongsTo.prototype.related = function (refresh, params) {
  var self = this;
  var modelTo = this.definition.modelTo;
  var pk = this.definition.keyTo;
  var fk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;
  
  if (arguments.length === 1) {
    params = refresh;
    refresh = false;
  } else if (arguments.length > 2) {
    throw new Error('Method can\'t be called with more than two arguments');
  }

  var cachedValue;
  if (!refresh) {
    cachedValue = self.getCache();
  }
  if (params instanceof ModelBaseClass) { // acts as setter
    modelInstance[fk] = params[pk];
    self.resetCache(params);
  } else if (typeof params === 'function') { // acts as async getter
    var cb = params;
    if (cachedValue === undefined) {
      modelTo.findById(modelInstance[fk], function (err, inst) {
        if (err) {
          return cb(err);
        }
        if (!inst) {
          return cb(null, null);
        }
        // Check if the foreign key matches the primary key
        if (inst[pk] === modelInstance[fk]) {
          self.resetCache(inst);
          cb(null, inst);
        } else {
          err = new Error('Key mismatch: ' + self.definition.modelFrom.modelName + '.' + fk
            + ': ' + modelInstance[fk]
            + ', ' + modelTo.modelName + '.' + pk + ': ' + inst[pk]);
          err.statusCode = 400;
          cb(err);
        }
      });
      return modelInstance[fk];
    } else {
      cb(null, cachedValue);
      return cachedValue;
    }
  } else if (params === undefined) { // acts as sync getter
    return cachedValue;
  } else { // setter
    modelInstance[fk] = params;
    self.resetCache();
  }
};

/**
 * A hasAndBelongsToMany relation creates a direct many-to-many connection with
 * another model, with no intervening model. For example, if your application
 * includes users and groups, with each group having many users and each user
 * appearing in many groups, you could declare the models this way:
 * ```
 *  User.hasAndBelongsToMany('groups', {model: Group, foreignKey: 'groupId'});
 * ```
 * 
 * @param {String|Object} modelTo Model object (or String name of model) to
 * which you are creating the relationship.
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that
 * corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Property name of foreign key field.
 * @property {Object} model Model object
 */
RelationDefinition.hasAndBelongsToMany = function hasAndBelongsToMany(modelFrom, modelTo, params) {
  params = params || {};
  var models = modelFrom.dataSource.modelBuilder.models;

  if ('string' === typeof modelTo) {
    params.as = modelTo;
    if (params.model) {
      modelTo = params.model;
    } else {
      modelTo = lookupModel(models, i8n.singularize(modelTo)) ||
        modelTo;
    }
    if (typeof modelTo === 'string') {
      throw new Error('Could not find "' + modelTo + '" relation for ' + modelFrom.modelName);
    }
  }

  if (!params.through) {
    var name1 = modelFrom.modelName + modelTo.modelName;
    var name2 = modelTo.modelName + modelFrom.modelName;
    params.through = lookupModel(models, name1) || lookupModel(models, name2) ||
      modelFrom.dataSource.define(name1);
  }
  params.through.belongsTo(modelFrom);
  params.through.belongsTo(modelTo);

  this.hasMany(modelFrom, modelTo, {as: params.as, through: params.through});

};

/**
 * A HasOne relation creates a one-to-one connection from modelFrom to modelTo.
 * This relation indicates that each instance of a model contains or possesses
 * one instance of another model. For example, each supplier in your application
 * has only one account.
 *
 * @param {Function} modelFrom The declaring model class
 * @param {String|Function} modelTo Model object (or String name of model) to
 * which you are creating the relationship.
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that
 * corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Property name of foreign key field.
 * @property {Object} model Model object
 */
RelationDefinition.hasOne = function (modelFrom, modelTo, params) {
  params = params || {};
  if ('string' === typeof modelTo) {
    params.as = modelTo;
    if (params.model) {
      modelTo = params.model;
    } else {
      var modelToName = modelTo.toLowerCase();
      modelTo = lookupModel(modelFrom.dataSource.modelBuilder.models, modelToName);
    }
  }

  var pk = modelFrom.dataSource.idName(modelTo.modelName) || 'id';
  var relationName = params.as || i8n.camelize(modelTo.modelName, true);

  var fk = params.foreignKey || i8n.camelize(modelFrom.modelName + '_id', true);
  
  var relationDef = modelFrom.relations[relationName] = new RelationDefinition({
    name: relationName,
    type: RelationTypes.hasOne,
    modelFrom: modelFrom,
    keyFrom: pk,
    keyTo: fk,
    modelTo: modelTo,
    properties: params.properties,
    options: params.options
  });

  modelFrom.dataSource.defineForeignKey(modelTo.modelName, fk, modelFrom.modelName);

  // Define a property for the scope so that we have 'this' for the scoped methods
  Object.defineProperty(modelFrom.prototype, relationName, {
    enumerable: true,
    configurable: true,
    get: function() {
      var relation = new HasOne(relationDef, this);
      var relationMethod = relation.related.bind(relation)
      relationMethod.create = relation.create.bind(relation);
      relationMethod.build = relation.build.bind(relation);
      return relationMethod;
    }
  });
};

/**
 * Create a target model instance
 * @param {Object} targetModelData The target model data
 * @callback {Function} [cb] Callback function
 * @param {String|Object} err Error string or object
 * @param {Object} The newly created target model instance
 */
HasOne.prototype.create = function (targetModelData, cb) {
  var self = this;
  var modelTo = this.definition.modelTo;
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  if (typeof targetModelData === 'function' && !cb) {
    cb = targetModelData;
    targetModelData = {};
  }
  targetModelData = targetModelData || {};
  targetModelData[fk] = modelInstance[pk];
  var query = {where: {}};
  query.where[fk] = targetModelData[fk];
  
  this.definition.applyScope(modelInstance, query);
  this.definition.applyProperties(modelInstance, targetModelData);
  
  modelTo.findOne(query, function(err, result) {
    if(err) {
      cb(err);
    } else if(result) {
      cb(new Error('HasOne relation cannot create more than one instance of '
        + modelTo.modelName));
    } else {
      modelTo.create(targetModelData, function (err, targetModel) {
        if (!err) {
          // Refresh the cache
          self.resetCache(targetModel);
          cb && cb(err, targetModel);
        } else {
          cb && cb(err);
        }
      });
    }
  });
};

/**
 * Create a target model instance
 * @param {Object} targetModelData The target model data
 * @callback {Function} [cb] Callback function
 * @param {String|Object} err Error string or object
 * @param {Object} The newly created target model instance
 */
HasMany.prototype.create = function (targetModelData, cb) {
  var self = this;
  var modelTo = this.definition.modelTo;
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;
  
  if (typeof targetModelData === 'function' && !cb) {
    cb = targetModelData;
    targetModelData = {};
  }
  targetModelData = targetModelData || {};
  targetModelData[fk] = modelInstance[pk];
  
  this.definition.applyProperties(modelInstance, targetModelData);
  
  modelTo.create(targetModelData, function(err, targetModel) {
    if(!err) {
      // Refresh the cache
      self.addToCache(targetModel);
      cb && cb(err, targetModel);
    } else {
      cb && cb(err);
    }
  });
};
/**
 * Build a target model instance
 * @param {Object} targetModelData The target model data
 * @returns {Object} The newly built target model instance
 */
HasMany.prototype.build = HasOne.prototype.build = function(targetModelData) {
  var modelTo = this.definition.modelTo;
  var pk = this.definition.keyFrom;
  var fk = this.definition.keyTo;
  
  targetModelData = targetModelData || {};
  targetModelData[fk] = this.modelInstance[pk];
  
  this.definition.applyProperties(this.modelInstance, targetModelData);
  
  return new modelTo(targetModelData);
};

/**
 * Define the method for the hasOne relation itself
 * It will support one of the following styles:
 * - order.customer(refresh, callback): Load the target model instance asynchronously
 * - order.customer(customer): Synchronous setter of the target model instance
 * - order.customer(): Synchronous getter of the target model instance
 *
 * @param {Boolean} refresh Reload from the data source
 * @param {Object|Function} params Query parameters
 * @returns {Object}
 */
HasOne.prototype.related = function (refresh, params) {
  var self = this;
  var modelTo = this.definition.modelTo;
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var definition = this.definition;
  var modelInstance = this.modelInstance;

  if (arguments.length === 1) {
    params = refresh;
    refresh = false;
  } else if (arguments.length > 2) {
    throw new Error('Method can\'t be called with more than two arguments');
  }

  var cachedValue;
  if (!refresh) {
    cachedValue = self.getCache();
  }
  if (params instanceof ModelBaseClass) { // acts as setter
    params[fk] = modelInstance[pk];
    self.resetCache(params);
  } else if (typeof params === 'function') { // acts as async getter
    var cb = params;
    if (cachedValue === undefined) {
      var query = {where: {}};
      query.where[fk] = modelInstance[pk];
      definition.applyScope(modelInstance, query);
      modelTo.findOne(query, function (err, inst) {
        if (err) {
          return cb(err);
        }
        if (!inst) {
          return cb(null, null);
        }
        // Check if the foreign key matches the primary key
        if (inst[fk] === modelInstance[pk]) {
          self.resetCache(inst);
          cb(null, inst);
        } else {
          err = new Error('Key mismatch: ' + self.definition.modelFrom.modelName + '.' + pk
            + ': ' + modelInstance[pk]
            + ', ' + modelTo.modelName + '.' + fk + ': ' + inst[fk]);
          err.statusCode = 400;
          cb(err);
        }
      });
      return modelInstance[pk];
    } else {
      cb(null, cachedValue);
      return cachedValue;
    }
  } else if (params === undefined) { // acts as sync getter
    return cachedValue;
  } else { // setter
    params[fk] = modelInstance[pk];
    self.resetCache();
  }
};
