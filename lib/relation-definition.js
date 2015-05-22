/*!
 * Dependencies
 */
var assert = require('assert');
var util = require('util');
var async = require('async');
var utils = require('./utils');
var i8n = require('inflection');
var defineScope = require('./scope.js').defineScope;
var mergeQuery = utils.mergeQuery;
var ModelBaseClass = require('./model.js');
var applyFilter = require('./connectors/memory').applyFilter;
var ValidationError = require('./validations.js').ValidationError;
var debug = require('debug')('loopback:relations');

var RelationTypes = {
  belongsTo: 'belongsTo',
  hasMany: 'hasMany',
  hasOne: 'hasOne',
  hasAndBelongsToMany: 'hasAndBelongsToMany',
  referencesMany: 'referencesMany',
  embedsOne: 'embedsOne',
  embedsMany: 'embedsMany'
};

var RelationClasses = {
  belongsTo: BelongsTo,
  hasMany: HasMany,
  hasManyThrough: HasManyThrough,
  hasOne: HasOne,
  hasAndBelongsToMany: HasAndBelongsToMany,
  referencesMany: ReferencesMany,
  embedsOne: EmbedsOne,
  embedsMany: EmbedsMany
};

exports.Relation = Relation;
exports.RelationDefinition = RelationDefinition;

exports.RelationTypes = RelationTypes;
exports.RelationClasses = RelationClasses;

exports.HasMany = HasMany;
exports.HasManyThrough = HasManyThrough;
exports.HasOne = HasOne;
exports.HasAndBelongsToMany = HasAndBelongsToMany;
exports.BelongsTo = BelongsTo;
exports.ReferencesMany = ReferencesMany;
exports.EmbedsOne = EmbedsOne;
exports.EmbedsMany = EmbedsMany;

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
};

function extendScopeMethods(definition, scopeMethods, ext) {
  var customMethods = [];
  var relationClass = RelationClasses[definition.type];
  if (definition.type === RelationTypes.hasMany && definition.modelThrough) {
    relationClass = RelationClasses.hasManyThrough;
  }
  if (typeof ext === 'function') {
    customMethods = ext.call(definition, scopeMethods, relationClass);
  } else if (typeof ext === 'object') {
    function createFunc(definition, relationMethod) {
      return function() {
        var relation = new relationClass(definition, this);
        return relationMethod.apply(relation, arguments);
      };
    };
    for (var key in ext) {
      var relationMethod = ext[key];
      var method = scopeMethods[key] = createFunc(definition, relationMethod);
      if (relationMethod.shared) {
        sharedMethod(definition, key, method, relationMethod);
      }
      customMethods.push(key);
    }
  }
  return [].concat(customMethods || []);
};

function bindRelationMethods(relation, relationMethod, definition) {
  var methods = definition.methods || {};
  Object.keys(methods).forEach(function(m) {
    if (typeof methods[m] !== 'function') return;
    relationMethod[m] = methods[m].bind(relation);
  });
};

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
  this.keyTo = definition.keyTo;
  this.polymorphic = definition.polymorphic;
  if (typeof this.polymorphic !== 'object') {
    assert(this.modelTo, 'Target model is required');
  }
  this.modelThrough = definition.modelThrough;
  this.keyThrough = definition.keyThrough;
  this.multiple = definition.multiple;
  this.properties = definition.properties || {};
  this.options = definition.options || {};
  this.scope = definition.scope;
  this.embed = definition.embed === true;
  this.methods = definition.methods || {};
}

RelationDefinition.prototype.toJSON = function () {
  var polymorphic = typeof this.polymorphic === 'object';

  var modelToName = this.modelTo && this.modelTo.modelName;
  if (!modelToName && polymorphic && this.type === 'belongsTo') {
    modelToName = '<polymorphic>';
  }

  var json = {
    name: this.name,
    type: this.type,
    modelFrom: this.modelFrom.modelName,
    keyFrom: this.keyFrom,
    modelTo: modelToName,
    keyTo: this.keyTo,
    multiple: this.multiple
  };
  if (this.modelThrough) {
    json.modelThrough = this.modelThrough.modelName;
    json.keyThrough = this.keyThrough;
  }
  if (polymorphic) {
    json.polymorphic = this.polymorphic;
  }
  return json;
};

/**
 * Define a relation scope method
 * @param {String} name of the method
 * @param {Function} function to define
 */
RelationDefinition.prototype.defineMethod = function(name, fn) {
  var relationClass = RelationClasses[this.type];
  var relationName = this.name;
  var modelFrom = this.modelFrom;
  var definition = this;
  var method;
  if (definition.multiple) {
    var scope = this.modelFrom.scopes[this.name];
    if (!scope) throw new Error('Unknown relation scope: ' + this.name);
    method = scope.defineMethod(name, function() {
      var relation = new relationClass(definition, this);
      return fn.apply(relation, arguments);
    });
  } else {
    definition.methods[name] = fn;
    method = function() {
      var rel = this[relationName];
      return rel[name].apply(rel, arguments);
    }
  }
  if (method && fn.shared) {
    sharedMethod(definition, name, method, fn);
    modelFrom.prototype['__' + name + '__' + relationName] = method;
  }
  return method;
};

/**
 * Apply the configured scope to the filter/query object.
 * @param {Object} modelInstance
 * @param {Object} filter (where, order, limit, fields, ...)
 */
RelationDefinition.prototype.applyScope = function(modelInstance, filter) {
  filter = filter || {};
  filter.where = filter.where || {};
  if ((this.type !== 'belongsTo' || this.type === 'hasOne')
    && typeof this.polymorphic === 'object') { // polymorphic
    var discriminator = this.polymorphic.discriminator;
    if (this.polymorphic.invert) {
      filter.where[discriminator] = this.modelTo.modelName;
    } else {
      filter.where[discriminator] = this.modelFrom.modelName;
    }
  }
  var scope;
  if (typeof this.scope === 'function') {
    scope = this.scope.call(this, modelInstance, filter);
  } else {
    scope = this.scope;
  }
  if (typeof scope === 'object') {
    mergeQuery(filter, scope);
  }
};

/**
 * Apply the configured properties to the target object.
 * @param {Object} modelInstance
 * @param {Object} target
 */
RelationDefinition.prototype.applyProperties = function(modelInstance, obj) {
  var source = modelInstance, target = obj;
  if (this.options.invertProperties) {
    source = obj;
    target = modelInstance;
  }
  if (this.options.embedsProperties) {
    target = target.__data[this.name] = {};
    target[this.keyTo] = source[this.keyTo];
  }
  var k, key;
  if (typeof this.properties === 'function') {
    var data = this.properties.call(this, source, target);
    for(k in data) {
      target[k] = data[k];
    }
  } else if (Array.isArray(this.properties)) {
    for(k = 0; k < this.properties.length; k++) {
      key = this.properties[k];
      target[key] = source[key];
    }
  } else if (typeof this.properties === 'object') {
    for(k in this.properties) {
      key = this.properties[k];
      target[key] = source[k];
    }
  }
  if ((this.type !== 'belongsTo' || this.type === 'hasOne')
    && typeof this.polymorphic === 'object') { // polymorphic
    var discriminator = this.polymorphic.discriminator;
    if (this.polymorphic.invert) {
      target[discriminator] = this.modelTo.modelName;
    } else {
      target[discriminator] = this.modelFrom.modelName;
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

Relation.prototype.callScopeMethod = function(methodName) {
  var args = Array.prototype.slice.call(arguments, 1);
  var modelInstance = this.modelInstance;
  var rel = modelInstance[this.definition.name];
  if (rel && typeof rel[methodName] === 'function') {
    return rel[methodName].apply(rel, args);
  } else {
    throw new Error('Unknown scope method: ' + methodName);
  }
};

/**
 * Fetch the related model(s) - this is a helper method to unify access.
 * @param (Boolean|Object} condOrRefresh refresh or conditions object
 * @param {Object} [options] Options
 * @param {Function} cb callback
 */
Relation.prototype.fetch = function(condOrRefresh, options, cb) {
  this.modelInstance[this.definition.name].apply(this.modelInstance, arguments);
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

/**
 * EmbedsOne subclass
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {EmbedsOne}
 * @constructor
 * @class EmbedsOne
 */
function EmbedsOne(definition, modelInstance) {
  if (!(this instanceof EmbedsOne)) {
    return new EmbedsOne(definition, modelInstance);
  }
  assert(definition.type === RelationTypes.embedsOne);
  Relation.apply(this, arguments);
}

util.inherits(EmbedsOne, Relation);

/**
 * EmbedsMany subclass
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {EmbedsMany}
 * @constructor
 * @class EmbedsMany
 */
function EmbedsMany(definition, modelInstance) {
  if (!(this instanceof EmbedsMany)) {
    return new EmbedsMany(definition, modelInstance);
  }
  assert(definition.type === RelationTypes.embedsMany);
  Relation.apply(this, arguments);
}

util.inherits(EmbedsMany, Relation);

/**
 * ReferencesMany subclass
 * @param {RelationDefinition|Object} definition
 * @param {Object} modelInstance
 * @returns {ReferencesMany}
 * @constructor
 * @class ReferencesMany
 */
function ReferencesMany(definition, modelInstance) {
  if (!(this instanceof ReferencesMany)) {
    return new ReferencesMany(definition, modelInstance);
  }
  assert(definition.type === RelationTypes.referencesMany);
  Relation.apply(this, arguments);
}

util.inherits(ReferencesMany, Relation);

/*!
 * Find the relation by foreign key
 * @param {*} foreignKey The foreign key
 * @returns {Array} The array of matching relation objects
 */
function findBelongsTo(modelFrom, modelTo, keyTo) {
  return Object.keys(modelFrom.relations)
    .map(function(k) { return modelFrom.relations[k]; })
    .filter(function(rel) {
      return (rel.type === RelationTypes.belongsTo &&
              rel.modelTo === modelTo &&
              (keyTo === undefined || rel.keyTo === keyTo));
    })
    .map(function(rel) {
      return rel.keyFrom;
    });
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

function lookupModelTo(modelFrom, modelTo, params, singularize) {
  if ('string' === typeof modelTo) {
    var modelToName;
    params.as = params.as || modelTo;
    modelTo = params.model || modelTo;
    if (typeof modelTo === 'string') {
      modelToName = (singularize ? i8n.singularize(modelTo) : modelTo).toLowerCase();
      modelTo = lookupModel(modelFrom.dataSource.modelBuilder.models, modelToName) || modelTo;
    }
    if (typeof modelTo === 'string') {
      modelToName = (singularize ? i8n.singularize(params.as) : params.as).toLowerCase();
      modelTo = lookupModel(modelFrom.dataSource.modelBuilder.models, modelToName) || modelTo;
    }
    if (typeof modelTo !== 'function') {
      throw new Error('Could not find "' + params.as + '" relation for ' + modelFrom.modelName);
    }
  }
  return modelTo;
}

/*!
 * Normalize polymorphic parameters
 * @param {Object|String} params Name of the polymorphic relation or params
 * @returns {Object} The normalized parameters
 */
function polymorphicParams(params, as) {
  if (typeof params === 'string') params = { as: params };
  if (typeof params.as !== 'string') params.as = as || 'reference'; // default
  params.foreignKey = params.foreignKey || i8n.camelize(params.as + '_id', true);
  params.discriminator = params.discriminator || i8n.camelize(params.as + '_type', true);
  return params;
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
  modelTo = lookupModelTo(modelFrom, modelTo, params, true);

  var relationName = params.as || i8n.camelize(modelTo.pluralModelName, true);
  var fk = params.foreignKey || i8n.camelize(thisClassName + '_id', true);
  var keyThrough = params.keyThrough || i8n.camelize(modelTo.modelName + '_id', true);

  var idName = modelFrom.dataSource.idName(modelFrom.modelName) || 'id';
  var discriminator, polymorphic;

  if (params.polymorphic) {
    polymorphic = polymorphicParams(params.polymorphic);
    if (params.invert) {
      polymorphic.invert = true;
      keyThrough = polymorphic.foreignKey;
    }
    discriminator = polymorphic.discriminator;
    if (!params.invert) {
      fk = polymorphic.foreignKey;
    }
    if (!params.through) {
      modelTo.dataSource.defineProperty(modelTo.modelName, discriminator, { type: 'string', index: true });
    }
  }

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
    options: params.options,
    keyThrough: keyThrough,
    polymorphic: polymorphic
  });

  definition.modelThrough = params.through;

  modelFrom.relations[relationName] = definition;

  if (!params.through) {
    // obviously, modelTo should have attribute called `fk`
    // for polymorphic relations, it is assumed to share the same fk type for all
    // polymorphic models
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

  var existsByIdFunc = scopeMethods.exists;
  modelFrom.prototype['__exists__' + relationName] = existsByIdFunc;

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

  var customMethods = extendScopeMethods(definition, scopeMethods, params.scopeMethods);

  for (var i = 0; i < customMethods.length; i++) {
    var methodName = customMethods[i];
    var method = scopeMethods[methodName];
    if (typeof method === 'function' && method.shared === true) {
      modelFrom.prototype['__' + methodName + '__' + relationName] = method;
    }
  };

  // Mix the property and scoped methods into the prototype class
  defineScope(modelFrom.prototype, params.through || modelTo, relationName, function () {
    var filter = {};
    filter.where = {};
    filter.where[fk] = this[idName];

    definition.applyScope(this, filter);

    if (definition.modelThrough) {
      var throughRelationName;

      // find corresponding belongsTo relations from through model as collect
      for(var r in definition.modelThrough.relations) {
        var relation = definition.modelThrough.relations[r];

        // should be a belongsTo and match modelTo and keyThrough
        // if relation is polymorphic then check keyThrough only
        if (relation.type === RelationTypes.belongsTo &&
          (relation.polymorphic && !relation.modelTo || relation.modelTo === definition.modelTo) &&
          (relation.keyFrom === definition.keyThrough)
          ) {
          throughRelationName = relation.name;
          break;
        }
      }

      if (definition.polymorphic && definition.polymorphic.invert) {
        filter.collect = definition.polymorphic.as;
        filter.include = filter.collect;
      } else {
        filter.collect = throughRelationName || i8n.camelize(modelTo.modelName, true);
        filter.include = filter.collect;
      }
    }

    return filter;
  }, scopeMethods, definition.options);

  return definition;
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
    sharedMethod(definition, methodName, method, relationMethod);
  }
  return method;
}

function sharedMethod(definition, methodName, method, relationMethod) {
  method.shared = true;
  method.accepts = relationMethod.accepts;
  method.returns = relationMethod.returns;
  method.http = relationMethod.http;
  method.description = relationMethod.description;
}

/**
 * Find a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Object} [options] Options
 * @param {Function} cb The callback function
 */
HasMany.prototype.findById = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var modelTo = this.definition.modelTo;
  var modelFrom = this.definition.modelFrom;
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  var idName = this.definition.modelTo.definition.idName();
  var filter = {};
  filter.where = {};
  filter.where[idName] = fkId;
  filter.where[fk] = modelInstance[pk];

  cb = cb || utils.createPromiseCallback();

  if (filter.where[fk] === undefined) {
    // Foreign key is undefined
    process.nextTick(cb);
    return cb.promise;
  }
  this.definition.applyScope(modelInstance, filter);

  modelTo.findOne(filter, options, function (err, inst) {
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
      err = new Error('Key mismatch: ' + modelFrom.modelName + '.' + pk
        + ': ' + modelInstance[pk]
        + ', ' + modelTo.modelName + '.' + fk + ': ' + inst[fk]);
      err.statusCode = 400;
      cb(err);
    }
  });
  return cb.promise;
};

/**
 * Find a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Object} [options] Options
 * @param {Function} cb The callback function
 */
HasMany.prototype.exists = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;
  cb = cb || utils.createPromiseCallback();


  this.findById(fkId, function (err, inst) {
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
  return cb.promise;
};

/**
 * Update a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Object} Changes to the data
 * @param {Object} [options] Options
 * @param {Function} cb The callback function
 */
HasMany.prototype.updateById = function (fkId, data, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  cb = cb || utils.createPromiseCallback();
  this.findById(fkId, options, function (err, inst) {
    if (err) {
      return cb && cb(err);
    }
    inst.updateAttributes(data, options, cb);
  });
  return cb.promise;
};

/**
 * Delete a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Object} [options] Options
 * @param {Function} cb The callback function
 */
HasMany.prototype.destroyById = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  cb = cb || utils.createPromiseCallback();
  var self = this;
  this.findById(fkId, options, function(err, inst) {
    if (err) {
      return cb(err);
    }
    self.removeFromCache(fkId);
    inst.destroy(options, cb);
  });
  return cb.promise;
};

var throughKeys = function(definition) {
  var modelThrough = definition.modelThrough;
  var pk2 = definition.modelTo.definition.idName();

  if (typeof definition.polymorphic === 'object') { // polymorphic
    var fk1 = definition.keyTo;
    if (definition.polymorphic.invert) {
      var fk2 = definition.polymorphic.foreignKey;
    } else {
      var fk2 = definition.keyThrough;
    }
  } else if (definition.modelFrom === definition.modelTo) {
    return findBelongsTo(modelThrough, definition.modelTo, pk2).
      sort(function (fk1, fk2) {
        //Fix for bug - https://github.com/strongloop/loopback-datasource-juggler/issues/571
        //Make sure that first key is mapped to modelFrom
        //& second key to modelTo. Order matters
        return (definition.keyTo === fk1) ? -1 : 1;
      });
  } else {
    var fk1 = findBelongsTo(modelThrough, definition.modelFrom,
                            definition.keyFrom)[0];
    var fk2 = findBelongsTo(modelThrough, definition.modelTo, pk2)[0];
  }
  return [fk1, fk2];
}

/**
 * Find a related item by foreign key
 * @param {*} fkId The foreign key value
 * @param {Object} [options] Options
 * @param {Function} cb The callback function
 */
HasManyThrough.prototype.findById = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var self = this;
  var modelTo = this.definition.modelTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;
  var modelThrough = this.definition.modelThrough;

  cb = cb || utils.createPromiseCallback();

  self.exists(fkId, options, function (err, exists) {
    if (err || !exists) {
      if (!err) {
        err = new Error('No relation found in ' + modelThrough.modelName
          + ' for (' + self.definition.modelFrom.modelName + '.' + modelInstance[pk]
          + ',' + modelTo.modelName + '.' + fkId + ')');
        err.statusCode = 404;
      }
      return cb(err);
    }
    modelTo.findById(fkId, options, function (err, inst) {
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
  return cb.promise;
};

/**
 * Delete a related item by foreign key
 * @param {*} fkId The foreign key
 * @param {Object} [options] Options
 * @param {Function} cb The callback function
 */
HasManyThrough.prototype.destroyById = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var self = this;
  var modelTo = this.definition.modelTo;
  var pk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;
  var modelThrough = this.definition.modelThrough;

  cb = cb || utils.createPromiseCallback();

  self.exists(fkId, options, function (err, exists) {
    if (err || !exists) {
      if (!err) {
        err = new Error('No record found in ' + modelThrough.modelName
          + ' for (' + self.definition.modelFrom.modelName + '.' + modelInstance[pk]
          + ' ,' + modelTo.modelName + '.' + fkId + ')');
        err.statusCode = 404;
      }
      return cb(err);
    }
    self.remove(fkId, options, function(err) {
      if(err) {
        return cb(err);
      }
      modelTo.deleteById(fkId, options, cb);
    });
  });
  return cb.promise;
};

// Create an instance of the target model and connect it to the instance of
// the source model by creating an instance of the through model
HasManyThrough.prototype.create = function create(data, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var self = this;
  var definition = this.definition;
  var modelTo = definition.modelTo;
  var modelThrough = definition.modelThrough;

  if (typeof data === 'function' && !cb) {
    cb = data;
    data = {};
  }
  cb = cb || utils.createPromiseCallback();

  var modelInstance = this.modelInstance;

  // First create the target model
  modelTo.create(data, options, function (err, to) {
    if (err) {
      return cb(err, to);
    }
    // The primary key for the target model
    var pk2 = definition.modelTo.definition.idName();
    var keys = throughKeys(definition);
    var fk1 = keys[0];
    var fk2 = keys[1];

    function createRelation(to, next) {
      var d = {}, q = {}, filter = {where:q};
      d[fk1] = q[fk1] = modelInstance[definition.keyFrom];
      d[fk2] = q[fk2] = to[pk2];
      definition.applyProperties(modelInstance, d);
      definition.applyScope(modelInstance, filter);

      // Then create the through model
      modelThrough.findOrCreate(filter, d, options, function (e, through) {
        if (e) {
          // Undo creation of the target model
          to.destroy(options, function () {
            next(e);
          });
        } else {
          self.addToCache(to);
          next(err, to);
        }
      });
    }

    // process array or single item
    if (!Array.isArray(to))
      createRelation(to, cb);
    else
      async.map(to, createRelation, cb);
  });
  return cb.promise;
};



/**
 * Add the target model instance to the 'hasMany' relation
 * @param {Object|ID} acInst The actual instance or id value
 * @param {Object} [data] Optional data object for the through model to be created
 * @param {Object} [options] Options
 * @param {Function} [cb] Callback function
 */
HasManyThrough.prototype.add = function (acInst, data, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var self = this;
  var definition = this.definition;
  var modelThrough = definition.modelThrough;
  var pk1 = definition.keyFrom;

  if (typeof data === 'function') {
    cb = data;
    data = {};
  }
  var query = {};

  data = data || {};
  cb = cb || utils.createPromiseCallback();

  // The primary key for the target model
  var pk2 = definition.modelTo.definition.idName();

  var keys = throughKeys(definition);
  var fk1 = keys[0];
  var fk2 = keys[1];

  query[fk1] = this.modelInstance[pk1];
  query[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;

  var filter = { where: query };

  definition.applyScope(this.modelInstance, filter);

  data[fk1] = this.modelInstance[pk1];
  data[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;

  definition.applyProperties(this.modelInstance, data);

  // Create an instance of the through model
  modelThrough.findOrCreate(filter, data, options, function(err, ac) {
    if(!err) {
      if (acInst instanceof definition.modelTo) {
        self.addToCache(acInst);
      }
    }
    cb(err, ac);
  });
  return cb.promise;
};

/**
 * Check if the target model instance is related to the 'hasMany' relation
 * @param {Object|ID} acInst The actual instance or id value
 */
HasManyThrough.prototype.exists = function (acInst, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var definition = this.definition;
  var modelThrough = definition.modelThrough;
  var pk1 = definition.keyFrom;

  var query = {};

  // The primary key for the target model
  var pk2 = definition.modelTo.definition.idName();

  var keys = throughKeys(definition);
  var fk1 = keys[0];
  var fk2 = keys[1];

  query[fk1] = this.modelInstance[pk1];
  query[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;

  var filter = { where: query };

  definition.applyScope(this.modelInstance, filter);

  cb = cb || utils.createPromiseCallback();

  modelThrough.count(filter.where, options, function(err, ac) {
    cb(err, ac > 0);
  });
  return cb.promise;
};

/**
 * Remove the target model instance from the 'hasMany' relation
 * @param {Object|ID) acInst The actual instance or id value
 */
HasManyThrough.prototype.remove = function (acInst, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var self = this;
  var definition = this.definition;
  var modelThrough = definition.modelThrough;
  var pk1 = definition.keyFrom;

  var query = {};

  // The primary key for the target model
  var pk2 = definition.modelTo.definition.idName();

  var keys = throughKeys(definition);
  var fk1 = keys[0];
  var fk2 = keys[1];

  query[fk1] = this.modelInstance[pk1];
  query[fk2] = (acInst instanceof definition.modelTo) ? acInst[pk2] : acInst;

  var filter = { where: query };

  definition.applyScope(this.modelInstance, filter);

  cb = cb || utils.createPromiseCallback();

  modelThrough.deleteAll(filter.where, options, function (err) {
    if (!err) {
      self.removeFromCache(query[fk2]);
    }
    cb(err);
  });
  return cb.promise;
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
  var discriminator, polymorphic;
  params = params || {};
  if ('string' === typeof modelTo && !params.polymorphic) {
    modelTo = lookupModelTo(modelFrom, modelTo, params);
  }

  var idName, relationName, fk;
  if (params.polymorphic) {
    relationName = params.as || (typeof modelTo === 'string' ? modelTo : null); // initially

    if (params.polymorphic === true) {
      // modelTo arg will be the name of the polymorphic relation (string)
      polymorphic = polymorphicParams(modelTo, relationName);
    } else {
      polymorphic = polymorphicParams(params.polymorphic, relationName);
    }

    modelTo = null; // will lookup dynamically

    idName = params.idName || 'id';
    relationName = params.as || polymorphic.as; // finally
    fk = polymorphic.foreignKey;
    discriminator = polymorphic.discriminator;

    if (polymorphic.idType) { // explicit key type
      modelFrom.dataSource.defineProperty(modelFrom.modelName, fk, { type: polymorphic.idType, index: true });
    } else { // try to use the same foreign key type as modelFrom
      modelFrom.dataSource.defineForeignKey(modelFrom.modelName, fk, modelFrom.modelName);
    }

    modelFrom.dataSource.defineProperty(modelFrom.modelName, discriminator, { type: 'string', index: true });
  } else {
    idName = modelTo.dataSource.idName(modelTo.modelName) || 'id';
    relationName = params.as || i8n.camelize(modelTo.modelName, true);
    fk = params.foreignKey || relationName + 'Id';

    modelFrom.dataSource.defineForeignKey(modelFrom.modelName, fk, modelTo.modelName);
  }

  var definition = modelFrom.relations[relationName] = new RelationDefinition({
    name: relationName,
    type: RelationTypes.belongsTo,
    modelFrom: modelFrom,
    keyFrom: fk,
    keyTo: idName,
    modelTo: modelTo,
    multiple: false,
    properties: params.properties,
    scope: params.scope,
    options: params.options,
    polymorphic: polymorphic,
    methods: params.methods
  });

  // Define a property for the scope so that we have 'this' for the scoped methods
  Object.defineProperty(modelFrom.prototype, relationName, {
    enumerable: true,
    configurable: true,
    get: function() {
      var relation = new BelongsTo(definition, this);
      var relationMethod = relation.related.bind(relation);
      relationMethod.getAsync = relation.getAsync.bind(relation);
      relationMethod.update = relation.update.bind(relation);
      relationMethod.destroy = relation.destroy.bind(relation);
      if (!polymorphic) {
        relationMethod.create = relation.create.bind(relation);
        relationMethod.build = relation.build.bind(relation);
        relationMethod._targetClass = definition.modelTo.modelName;
      }
      bindRelationMethods(relation, relationMethod, definition);
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

  return definition;
};

BelongsTo.prototype.create = function(targetModelData, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var self = this;
  var modelTo = this.definition.modelTo;
  var fk = this.definition.keyFrom;
  var pk = this.definition.keyTo;
  var modelInstance = this.modelInstance;

  if (typeof targetModelData === 'function' && !cb) {
    cb = targetModelData;
    targetModelData = {};
  }
  cb = cb || utils.createPromiseCallback();

  this.definition.applyProperties(modelInstance, targetModelData || {});

  modelTo.create(targetModelData, options, function(err, targetModel) {
    if(!err) {
      modelInstance[fk] = targetModel[pk];
      if (modelInstance.isNewRecord()) {
        self.resetCache(targetModel);
        cb && cb(err, targetModel);
      } else {
        modelInstance.save(options, function(err, inst) {
          if (cb && err) return cb && cb(err);
          self.resetCache(targetModel);
          cb && cb(err, targetModel);
        });
      }
    } else {
      cb && cb(err);
    }
  });
  return cb.promise;
};

BelongsTo.prototype.build = function(targetModelData) {
  var modelTo = this.definition.modelTo;
  this.definition.applyProperties(this.modelInstance, targetModelData || {});
  return new modelTo(targetModelData);
};

BelongsTo.prototype.update = function (targetModelData, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  cb = cb || utils.createPromiseCallback();
  var definition = this.definition;
  this.fetch(options, function(err, inst) {
    if (inst instanceof ModelBaseClass) {
      inst.updateAttributes(targetModelData, options, cb);
    } else {
      cb(new Error('BelongsTo relation ' + definition.name
        + ' is empty'));
    }
  });
  return cb.promise;
};

BelongsTo.prototype.destroy = function (options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    cb = options;
    options = {};
  }
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;
  var fk = this.definition.keyFrom;

  cb = cb || utils.createPromiseCallback();

  this.fetch(options, function(err, targetModel) {
    if (targetModel instanceof ModelBaseClass) {
      modelInstance[fk] = null;
      modelInstance.save(options, function(err, targetModel) {
        if (cb && err) return cb && cb(err);
        cb && cb(err, targetModel);
      });
    } else {
      cb(new Error('BelongsTo relation ' + definition.name
        + ' is empty'));
    }
  });
  return cb.promise;
};

/**
 * Define the method for the belongsTo relation itself
 * It will support one of the following styles:
 * - order.customer(refresh, options, callback): Load the target model instance asynchronously
 * - order.customer(customer): Synchronous setter of the target model instance
 * - order.customer(): Synchronous getter of the target model instance
 *
 * @param refresh
 * @param params
 * @returns {*}
 */
BelongsTo.prototype.related = function (condOrRefresh, options, cb) {
  var self = this;
  var modelFrom = this.definition.modelFrom;
  var modelTo = this.definition.modelTo;
  var pk = this.definition.keyTo;
  var fk = this.definition.keyFrom;
  var modelInstance = this.modelInstance;
  var discriminator;
  var scopeQuery = null;
  var newValue;

  if ((condOrRefresh instanceof ModelBaseClass) &&
    options === undefined && cb === undefined) {
    // order.customer(customer)
    newValue = condOrRefresh;
    condOrRefresh = false;
  } else if (typeof condOrRefresh === 'function' &&
    options === undefined && cb === undefined) {
    // order.customer(cb)
    cb = condOrRefresh;
    condOrRefresh = false;
  } else if (typeof options === 'function' && cb === undefined) {
    // order.customer(condOrRefresh, cb)
    cb = options;
    options = {};
  }
  if (!newValue) {
    scopeQuery = condOrRefresh;
  }

  if (typeof this.definition.polymorphic === 'object') {
    discriminator = this.definition.polymorphic.discriminator;
  }

  var cachedValue;
  if (!condOrRefresh) {
    cachedValue = self.getCache();
  }
  if (newValue) { // acts as setter
    modelInstance[fk] = newValue[pk];

    if (discriminator) {
      modelInstance[discriminator] = newValue.constructor.modelName;
    }

    this.definition.applyProperties(modelInstance, newValue);

    self.resetCache(newValue);
  } else if (typeof cb === 'function') { // acts as async getter

    if (discriminator) {
      var modelToName = modelInstance[discriminator];
      if (typeof modelToName !== 'string') {
        throw new Error('Polymorphic model not found: `' + discriminator + '` not set');
      }
      modelToName = modelToName.toLowerCase();
      modelTo = lookupModel(modelFrom.dataSource.modelBuilder.models, modelToName);
      if (!modelTo) {
        throw new Error('Polymorphic model not found: `' + modelToName + '`');
      }
    }

    if (cachedValue === undefined || !(cachedValue instanceof ModelBaseClass)) {
      var query = {where: {}};
      query.where[pk] = modelInstance[fk];

      if (query.where[pk] === undefined
        || query.where[pk] === null) {
        // Foreign key is undefined
        return process.nextTick(cb);
      }

      this.definition.applyScope(modelInstance, query);

      if (scopeQuery) mergeQuery(query, scopeQuery);

      if (Array.isArray(query.fields) && query.fields.indexOf(pk) === -1) {
          query.fields.push(pk); // always include the pk
      }

      modelTo.findOne(query, options, function (err, inst) {
        if (err) {
          return cb(err);
        }
        if (!inst) {
          return cb(null, null);
        }
        // Check if the foreign key matches the primary key
        if (inst[pk] && modelInstance[fk]
          && inst[pk].toString() === modelInstance[fk].toString()) {
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
  } else if (condOrRefresh === undefined) { // acts as sync getter
    return cachedValue;
  } else { // setter
    modelInstance[fk] = newValue;
    self.resetCache();
  }
};


/**
 * Define a Promise-based method for the belongsTo relation itself
 * - order.customer.get(cb): Load the target model instance asynchronously
 *
 * @param {Function} cb Callback of the form function (err, inst)
 * @returns {Promise | Undefined} returns promise if callback is omitted
 */
BelongsTo.prototype.getAsync = function (options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // order.customer.getAsync(cb)
    cb = options;
    options = {};
  }
  cb = cb || utils.createPromiseCallback();
  this.related(true, options, cb);
  return cb.promise;
}


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
  modelTo = lookupModelTo(modelFrom, modelTo, params, true);

  var models = modelFrom.dataSource.modelBuilder.models;

  if (!params.through) {
    if (params.polymorphic) throw new Error('Polymorphic relations need a through model');
    var name1 = modelFrom.modelName + modelTo.modelName;
    var name2 = modelTo.modelName + modelFrom.modelName;
    params.through = lookupModel(models, name1) || lookupModel(models, name2) ||
      modelFrom.dataSource.define(name1);
  }

  var options = {as: params.as, through: params.through};
  options.properties = params.properties;
  options.scope = params.scope;

  if (params.polymorphic) {
    var polymorphic = polymorphicParams(params.polymorphic);
    options.polymorphic = polymorphic; // pass through
    var accessor = params.through.prototype[polymorphic.as];
    if (typeof accessor !== 'function') { // declare once
      // use the name of the polymorphic rel, not modelTo
      params.through.belongsTo(polymorphic.as, { polymorphic: true });
    }
  } else {
    params.through.belongsTo(modelFrom);
  }

  params.through.belongsTo(modelTo);

  return this.hasMany(modelFrom, modelTo, options);
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
  modelTo = lookupModelTo(modelFrom, modelTo, params);

  var pk = modelFrom.dataSource.idName(modelFrom.modelName) || 'id';
  var relationName = params.as || i8n.camelize(modelTo.modelName, true);

  var fk = params.foreignKey || i8n.camelize(modelFrom.modelName + '_id', true);
  var discriminator, polymorphic;

  if (params.polymorphic) {
    polymorphic = polymorphicParams(params.polymorphic);
    fk = polymorphic.foreignKey;
    discriminator = polymorphic.discriminator;
    if (!params.through) {
      modelTo.dataSource.defineProperty(modelTo.modelName, discriminator, { type: 'string', index: true });
    }
  }

  var definition = modelFrom.relations[relationName] = new RelationDefinition({
    name: relationName,
    type: RelationTypes.hasOne,
    modelFrom: modelFrom,
    keyFrom: pk,
    keyTo: fk,
    modelTo: modelTo,
    multiple: false,
    properties: params.properties,
    scope: params.scope,
    options: params.options,
    polymorphic: polymorphic,
    methods: params.methods
  });

  modelTo.dataSource.defineForeignKey(modelTo.modelName, fk, modelFrom.modelName);

  // Define a property for the scope so that we have 'this' for the scoped methods
  Object.defineProperty(modelFrom.prototype, relationName, {
    enumerable: true,
    configurable: true,
    get: function() {
      var relation = new HasOne(definition, this);
      var relationMethod = relation.related.bind(relation)
      relationMethod.getAsync = relation.getAsync.bind(relation);
      relationMethod.create = relation.create.bind(relation);
      relationMethod.build = relation.build.bind(relation);
      relationMethod.update = relation.update.bind(relation);
      relationMethod.destroy = relation.destroy.bind(relation);
      relationMethod._targetClass = definition.modelTo.modelName;
      bindRelationMethods(relation, relationMethod, definition);
      return relationMethod;
    }
  });

  // FIXME: [rfeng] Wrap the property into a function for remoting
  // so that it can be accessed as /api/<model>/<id>/<hasOneRelationName>
  // For example, /api/orders/1/customer
  modelFrom.prototype['__get__' + relationName] = function() {
    var f = this[relationName];
    f.apply(this, arguments);
  };

  modelFrom.prototype['__create__' + relationName] = function() {
    var f = this[relationName].create;
    f.apply(this, arguments);
  };

  modelFrom.prototype['__update__' + relationName] = function() {
    var f = this[relationName].update;
    f.apply(this, arguments);
  };

  modelFrom.prototype['__destroy__' + relationName] = function() {
    var f = this[relationName].destroy;
    f.apply(this, arguments);
  };

  return definition;
};

/**
 * Create a target model instance
 * @param {Object} targetModelData The target model data
 * @callback {Function} [cb] Callback function
 * @param {String|Object} err Error string or object
 * @param {Object} The newly created target model instance
 */
HasOne.prototype.create = function (targetModelData, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.profile.create(options, cb)
    cb = options;
    options = {};
  }
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
  cb = cb || utils.createPromiseCallback();

  targetModelData[fk] = modelInstance[pk];
  var query = {where: {}};
  query.where[fk] = targetModelData[fk];

  this.definition.applyScope(modelInstance, query);
  this.definition.applyProperties(modelInstance, targetModelData);

  modelTo.findOrCreate(query, targetModelData, options,
    function(err, targetModel, created) {
      if (err) {
        return cb && cb(err);
      }
      if (created) {
        // Refresh the cache
        self.resetCache(targetModel);
        cb && cb(err, targetModel);
      } else {
        cb && cb(new Error('HasOne relation cannot create more than one instance of '
          + modelTo.modelName));
      }
    });
  return cb.promise;
};

HasOne.prototype.update = function(targetModelData, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.profile.update(data, cb)
    cb = options;
    options = {};
  }
  cb = cb || utils.createPromiseCallback();
  var definition = this.definition;
  var fk = this.definition.keyTo;
  this.fetch(function(err, targetModel) {
    if (targetModel instanceof ModelBaseClass) {
      delete targetModelData[fk];
      targetModel.updateAttributes(targetModelData, cb);
    } else {
      cb(new Error('HasOne relation ' + definition.name
        + ' is empty'));
    }
  });
  return cb.promise;
};

HasOne.prototype.destroy = function (options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.profile.destroy(cb)
    cb = options;
    options = {};
  }
  cb = cb || utils.createPromiseCallback();
  var definition = this.definition;
  this.fetch(function(err, targetModel) {
    if (targetModel instanceof ModelBaseClass) {
      targetModel.destroy(options, cb);
    } else {
      cb(new Error('HasOne relation ' + definition.name
        + ' is empty'));
    }
  });
  return cb.promise;
};

/**
 * Create a target model instance
 * @param {Object} targetModelData The target model data
 * @callback {Function} [cb] Callback function
 * @param {String|Object} err Error string or object
 * @param {Object} The newly created target model instance
 */
HasMany.prototype.create = function (targetModelData, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.create(data, cb)
    cb = options;
    options = {};
  }
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
  cb = cb || utils.createPromiseCallback();

  var fkAndProps = function(item) {
    item[fk] = modelInstance[pk];
    self.definition.applyProperties(modelInstance, item);
  };

  var apply = function(data, fn) {
    if (Array.isArray(data)) {
      data.forEach(fn);
    } else {
      fn(data);
    }
  };

  apply(targetModelData, fkAndProps);

  modelTo.create(targetModelData, options, function(err, targetModel) {
    if(!err) {
      //Refresh the cache
      apply(targetModel, self.addToCache.bind(self));
      cb && cb(err, targetModel);
    } else {
      cb && cb(err);
    }
  });
  return cb.promise;
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
HasOne.prototype.related = function (condOrRefresh, options, cb) {
  var self = this;
  var modelTo = this.definition.modelTo;
  var fk = this.definition.keyTo;
  var pk = this.definition.keyFrom;
  var definition = this.definition;
  var modelInstance = this.modelInstance;
  var newValue;

  if ((condOrRefresh instanceof ModelBaseClass) &&
    options === undefined && cb === undefined) {
    // order.customer(customer)
    newValue = condOrRefresh;
    condOrRefresh = false;
  } else if (typeof condOrRefresh === 'function' &&
    options === undefined && cb === undefined) {
    // customer.profile(cb)
    cb = condOrRefresh;
    condOrRefresh = false;
  } else if (typeof options === 'function' && cb === undefined) {
    // customer.profile(condOrRefresh, cb)
    cb = options;
    options = {};
  }

  var cachedValue;
  if (!condOrRefresh) {
    cachedValue = self.getCache();
  }
  if (newValue) { // acts as setter
    newValue[fk] = modelInstance[pk];
    self.resetCache(newValue);
  } else if (typeof cb === 'function') { // acts as async getter
    if (cachedValue === undefined) {
      var query = {where: {}};
      query.where[fk] = modelInstance[pk];
      definition.applyScope(modelInstance, query);
      modelTo.findOne(query, options, function (err, inst) {
        if (err) {
          return cb(err);
        }
        if (!inst) {
          return cb(null, null);
        }
        // Check if the foreign key matches the primary key
        if (inst[fk] && modelInstance[pk]
          && inst[fk].toString() === modelInstance[pk].toString()) {
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
  } else if (condOrRefresh === undefined) { // acts as sync getter
    return cachedValue;
  } else { // setter
    newValue[fk] = modelInstance[pk];
    self.resetCache();
  }
};

/**
 * Define a Promise-based method for the hasOne relation itself
 * - order.customer.getAsync(cb): Load the target model instance asynchronously
 *
 * @param {Function} cb Callback of the form function (err, inst)
 * @returns {Promise | Undefined} Returns promise if cb is omitted
 */

HasOne.prototype.getAsync = function (options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // order.profile.getAsync(cb)
    cb = options;
    options = {};
  }
  cb = cb || utils.createPromiseCallback();
  this.related(true, cb);
  return cb.promise;
};

RelationDefinition.embedsOne = function (modelFrom, modelTo, params) {
  params = params || {};
  modelTo = lookupModelTo(modelFrom, modelTo, params);

  var thisClassName = modelFrom.modelName;
  var relationName = params.as || (i8n.camelize(modelTo.modelName, true) + 'Item');
  var propertyName = params.property || i8n.camelize(modelTo.modelName, true);
  var idName = modelTo.dataSource.idName(modelTo.modelName) || 'id';

  if (relationName === propertyName) {
    propertyName = '_' + propertyName;
    debug('EmbedsOne property cannot be equal to relation name: ' +
      'forcing property %s for relation %s', propertyName, relationName);
  }

  var definition = modelFrom.relations[relationName] = new RelationDefinition({
    name: relationName,
    type: RelationTypes.embedsOne,
    modelFrom: modelFrom,
    keyFrom: propertyName,
    keyTo: idName,
    modelTo: modelTo,
    multiple: false,
    properties: params.properties,
    scope: params.scope,
    options: params.options,
    embed: true,
    methods: params.methods
  });

  var opts = { type: modelTo };

  if (params.default === true) {
    opts.default = function() { return new modelTo(); };
  } else if (typeof params.default === 'object') {
    opts.default = (function(def) {
      return function() {
        return new modelTo(def);
      };
    }(params.default));
  }

  modelFrom.dataSource.defineProperty(modelFrom.modelName, propertyName, opts);

  // validate the embedded instance
  if (definition.options.validate !== false) {
    modelFrom.validate(relationName, function(err) {
      var inst = this[propertyName];
      if (inst instanceof modelTo) {
        if (!inst.isValid()) {
          var first = Object.keys(inst.errors)[0];
          var msg = 'is invalid: `' + first + '` ' + inst.errors[first];
          this.errors.add(relationName, msg, 'invalid');
          err(false);
        }
      }
    });
  }

  // Define a property for the scope so that we have 'this' for the scoped methods
  Object.defineProperty(modelFrom.prototype, relationName, {
    enumerable: true,
    configurable: true,
    get: function() {
      var relation = new EmbedsOne(definition, this);
      var relationMethod = relation.related.bind(relation);
      relationMethod.create = relation.create.bind(relation);
      relationMethod.build = relation.build.bind(relation);
      relationMethod.update = relation.update.bind(relation);
      relationMethod.destroy = relation.destroy.bind(relation);
      relationMethod.value = relation.embeddedValue.bind(relation);
      relationMethod._targetClass = definition.modelTo.modelName;
      bindRelationMethods(relation, relationMethod, definition);
      return relationMethod;
    }
  });

  // FIXME: [rfeng] Wrap the property into a function for remoting
  // so that it can be accessed as /api/<model>/<id>/<embedsOneRelationName>
  // For example, /api/orders/1/customer
  modelFrom.prototype['__get__' + relationName] = function() {
    var f = this[relationName];
    f.apply(this, arguments);
  };

  modelFrom.prototype['__create__' + relationName] = function() {
    var f = this[relationName].create;
    f.apply(this, arguments);
  };

  modelFrom.prototype['__update__' + relationName] = function() {
    var f = this[relationName].update;
    f.apply(this, arguments);
  };

  modelFrom.prototype['__destroy__' + relationName] = function() {
    var f = this[relationName].destroy;
    f.apply(this, arguments);
  };

  return definition;
};

EmbedsOne.prototype.related = function (condOrRefresh, options, cb) {
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;
  var propertyName = this.definition.keyFrom;
  var newValue;

  if ((condOrRefresh instanceof ModelBaseClass) &&
    options === undefined && cb === undefined) {
    // order.customer(customer)
    newValue = condOrRefresh;
    condOrRefresh = false;
  } else if (typeof condOrRefresh === 'function' &&
    options === undefined && cb === undefined) {
    // order.customer(cb)
    cb = condOrRefresh;
    condOrRefresh = false;
  } else if (typeof options === 'function' && cb === undefined) {
    // order.customer(condOrRefresh, cb)
    cb = options;
    options = {};
  }

  if (newValue) { // acts as setter
    if (newValue instanceof modelTo) {
      this.definition.applyProperties(modelInstance, newValue);
      modelInstance.setAttribute(propertyName, newValue);
    }
    return;
  }

  var embeddedInstance = modelInstance[propertyName];

  if (embeddedInstance) {
    embeddedInstance.__persisted = true;
  }

  if (typeof cb === 'function') { // acts as async getter
    process.nextTick(function() {
      cb(null, embeddedInstance);
    });
  } else if (condOrRefresh === undefined) { // acts as sync getter
    return embeddedInstance;
  }
};

EmbedsOne.prototype.embeddedValue = function(modelInstance) {
  modelInstance = modelInstance || this.modelInstance;
  return modelInstance[this.definition.keyFrom];
};

EmbedsOne.prototype.create = function (targetModelData, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // order.customer.create(data, cb)
    cb = options;
    options = {};
  }
  var modelTo = this.definition.modelTo;
  var propertyName = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  if (typeof targetModelData === 'function' && !cb) {
    cb = targetModelData;
    targetModelData = {};
  }

  targetModelData = targetModelData || {};
  cb = cb || utils.createPromiseCallback();

  var inst = this.callScopeMethod('build', targetModelData);

  var updateEmbedded = function() {
    if (modelInstance.isNewRecord()) {
      modelInstance.setAttribute(propertyName, inst);
      modelInstance.save(options, function(err) {
          cb(err, err ? null : inst);
      });
    } else {
      modelInstance.updateAttribute(propertyName,
        inst, options, function(err) {
        cb(err, err ? null : inst);
      });
    }
  };

  if (this.definition.options.persistent) {
    inst.save(options, function(err) { // will validate
      if (err) return cb(err, inst);
      updateEmbedded();
    });
  } else {
    var err = inst.isValid() ? null : new ValidationError(inst);
    if (err) {
      process.nextTick(function() {
        cb(err);
      });
    } else {
      updateEmbedded();
    }
  }
  return cb.promise;
};

EmbedsOne.prototype.build = function (targetModelData) {
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;
  var propertyName = this.definition.keyFrom;
  var forceId = this.definition.options.forceId;
  var persistent = this.definition.options.persistent;
  var connector = modelTo.dataSource.connector;

  targetModelData = targetModelData || {};

  this.definition.applyProperties(modelInstance, targetModelData);

  var pk = this.definition.keyTo;
  var pkProp = modelTo.definition.properties[pk];

  var assignId = (forceId || targetModelData[pk] === undefined);
  assignId = assignId && !persistent && (pkProp && pkProp.generated);

  if (assignId && typeof connector.generateId === 'function') {
      var id = connector.generateId(modelTo.modelName, targetModelData, pk);
      targetModelData[pk] = id;
  }

  var embeddedInstance = new modelTo(targetModelData);
  modelInstance[propertyName] = embeddedInstance;

  return embeddedInstance;
};

EmbedsOne.prototype.update = function (targetModelData, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // order.customer.update(data, cb)
    cb = options;
    options = {};
  }
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;
  var propertyName = this.definition.keyFrom;

  var isInst = targetModelData instanceof ModelBaseClass;
  var data = isInst ? targetModelData.toObject() : targetModelData;

  var embeddedInstance = modelInstance[propertyName];
  if (embeddedInstance instanceof modelTo) {
    embeddedInstance.setAttributes(data);
    cb = cb || utils.createPromiseCallback();
    if (typeof cb === 'function') {
      modelInstance.save(options, function(err, inst) {
        cb(err, inst ? inst[propertyName] : embeddedInstance);
      });
    }
  } else if (!embeddedInstance && cb) {
    return this.callScopeMethod('create', data, cb);
  } else if (!embeddedInstance) {
    return this.callScopeMethod('build', data);
  }
  return cb.promise;
};

EmbedsOne.prototype.destroy = function (options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // order.customer.destroy(cb)
    cb = options;
    options = {};
  }
  var modelInstance = this.modelInstance;
  var propertyName = this.definition.keyFrom;
  modelInstance.unsetAttribute(propertyName, true);
  cb = cb || utils.createPromiseCallback();
  modelInstance.save(function (err, result) {
    cb && cb(err, result);
  });
  return cb.promise;
};

RelationDefinition.embedsMany = function embedsMany(modelFrom, modelTo, params) {
  params = params || {};
  modelTo = lookupModelTo(modelFrom, modelTo, params, true);

  var thisClassName = modelFrom.modelName;
  var relationName = params.as || (i8n.camelize(modelTo.modelName, true) + 'List');
  var propertyName = params.property || i8n.camelize(modelTo.pluralModelName, true);
  var idName = modelTo.dataSource.idName(modelTo.modelName) || 'id';

  if (relationName === propertyName) {
    propertyName = '_' + propertyName;
    debug('EmbedsMany property cannot be equal to relation name: ' +
      'forcing property %s for relation %s', propertyName, relationName);
  }

  var definition = modelFrom.relations[relationName] = new RelationDefinition({
    name: relationName,
    type: RelationTypes.embedsMany,
    modelFrom: modelFrom,
    keyFrom: propertyName,
    keyTo: idName,
    modelTo: modelTo,
    multiple: true,
    properties: params.properties,
    scope: params.scope,
    options: params.options,
    embed: true
  });

  modelFrom.dataSource.defineProperty(modelFrom.modelName, propertyName, {
    type: [modelTo], default: function() { return []; }
  });

  if (typeof modelTo.dataSource.connector.generateId !== 'function') {
    modelFrom.validate(propertyName, function(err) {
      var self = this;
      var embeddedList = this[propertyName] || [];
      var hasErrors = false;
      embeddedList.forEach(function(item, idx) {
        if (item instanceof modelTo && item[idName] == undefined) {
          hasErrors = true;
          var msg = 'contains invalid item at index `' + idx + '`:';
          msg += ' `' + idName + '` is blank';
          self.errors.add(propertyName, msg, 'invalid');
        }
      });
      if (hasErrors) err(false);
    });
  }

  if (!params.polymorphic) {
    modelFrom.validate(propertyName, function(err) {
      var embeddedList = this[propertyName] || [];
      var ids = embeddedList.map(function(m) { return m[idName]; });
      var uniqueIds = ids.filter(function(id, pos) {
          return ids.indexOf(id) === pos;
      });
      if (ids.length !== uniqueIds.length) {
        this.errors.add(propertyName, 'contains duplicate `' + idName + '`', 'uniqueness');
        err(false);
      }
    }, { code: 'uniqueness' })
  }

  // validate all embedded items
  if (definition.options.validate !== false) {
    modelFrom.validate(propertyName, function(err) {
      var self = this;
      var embeddedList = this[propertyName] || [];
      var hasErrors = false;
      embeddedList.forEach(function(item, idx) {
        if (item instanceof modelTo) {
          if (!item.isValid()) {
            hasErrors = true;
            var id = item[idName];
            var first = Object.keys(item.errors)[0];
            if (id) {
              var msg = 'contains invalid item: `' + id + '`';
            } else {
              var msg = 'contains invalid item at index `' + idx + '`';
            }
            msg += ' (`' + first + '` ' + item.errors[first] + ')';
            self.errors.add(propertyName, msg, 'invalid');
          }
        } else {
          hasErrors = true;
          self.errors.add(propertyName, 'contains invalid item', 'invalid');
        }
      });
      if (hasErrors) err(false);
    });
  }

  var scopeMethods = {
    findById: scopeMethod(definition, 'findById'),
    destroy: scopeMethod(definition, 'destroyById'),
    updateById: scopeMethod(definition, 'updateById'),
    exists: scopeMethod(definition, 'exists'),
    add: scopeMethod(definition, 'add'),
    remove: scopeMethod(definition, 'remove'),
    get: scopeMethod(definition, 'get'),
    set: scopeMethod(definition, 'set'),
    unset: scopeMethod(definition, 'unset'),
    at: scopeMethod(definition, 'at'),
    value: scopeMethod(definition, 'embeddedValue')
  };

  var findByIdFunc = scopeMethods.findById;
  modelFrom.prototype['__findById__' + relationName] = findByIdFunc;

  var destroyByIdFunc = scopeMethods.destroy;
  modelFrom.prototype['__destroyById__' + relationName] = destroyByIdFunc;

  var updateByIdFunc = scopeMethods.updateById;
  modelFrom.prototype['__updateById__' + relationName] = updateByIdFunc;

  var addFunc = scopeMethods.add;
  modelFrom.prototype['__link__' + relationName] = addFunc;

  var removeFunc = scopeMethods.remove;
  modelFrom.prototype['__unlink__' + relationName] = removeFunc;

  scopeMethods.create = scopeMethod(definition, 'create');
  scopeMethods.build = scopeMethod(definition, 'build');

  scopeMethods.related = scopeMethod(definition, 'related'); // bound to definition

  if (!definition.options.persistent) {
    scopeMethods.destroyAll = scopeMethod(definition, 'destroyAll');
  }

  var customMethods = extendScopeMethods(definition, scopeMethods, params.scopeMethods);

  for (var i = 0; i < customMethods.length; i++) {
    var methodName = customMethods[i];
    var method = scopeMethods[methodName];
    if (typeof method === 'function' && method.shared === true) {
      modelFrom.prototype['__' + methodName + '__' + relationName] = method;
    }
  };

  // Mix the property and scoped methods into the prototype class
  var scopeDefinition = defineScope(modelFrom.prototype, modelTo, relationName, function () {
    return {};
  }, scopeMethods, definition.options);

  scopeDefinition.related = scopeMethods.related;

  return definition;
};

EmbedsMany.prototype.prepareEmbeddedInstance = function(inst) {
  if (inst && inst.triggerParent !== 'function') {
    var self = this;
    var propertyName = this.definition.keyFrom;
    var modelInstance = this.modelInstance;
    if (this.definition.options.persistent) {
        var pk = this.definition.keyTo;
        inst.__persisted = !!inst[pk];
    } else {
        inst.__persisted = true;
    }
    inst.triggerParent = function(actionName, callback) {
      if (actionName === 'save' || actionName === 'destroy') {
        var embeddedList = self.embeddedList();
        if (actionName === 'destroy') {
          var index = embeddedList.indexOf(inst);
          if (index > -1) embeddedList.splice(index, 1);
        }
        modelInstance.updateAttribute(propertyName,
          embeddedList, function(err, modelInst) {
          callback(err, err ? null : modelInst);
        });
      } else {
        process.nextTick(callback);
      }
    };
    var originalTrigger = inst.trigger;
    inst.trigger = function(actionName, work, data, callback) {
      if (typeof work === 'function') {
        var originalWork = work;
        work = function(next) {
          originalWork.call(this, function(done) {
            inst.triggerParent(actionName, function(err, inst) {
              next(done); // TODO [fabien] - error handling?
            });
          });
        };
      }
      originalTrigger.call(this, actionName, work, data, callback);
    };
  }
};

EmbedsMany.prototype.embeddedList =
  EmbedsMany.prototype.embeddedValue = function(modelInstance) {
  modelInstance = modelInstance || this.modelInstance;
  var embeddedList = modelInstance[this.definition.keyFrom] || [];
  embeddedList.forEach(this.prepareEmbeddedInstance.bind(this));
  return embeddedList;
};

EmbedsMany.prototype.related = function(receiver, scopeParams, condOrRefresh, options, cb) {
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;

  var actualCond = {};

  if (typeof condOrRefresh === 'function' &&
    options === undefined && cb === undefined) {
    // customer.emails(receiver, scopeParams, cb)
    cb = condOrRefresh;
    condOrRefresh = false;
  } else if (typeof options === 'function' && cb === undefined) {
    // customer.emails(receiver, scopeParams, condOrRefresh, cb)
    cb = options;
    options = {};
  }

  if (typeof condOrRefresh === 'object') {
    actualCond = condOrRefresh;
  }


  var embeddedList = this.embeddedList(receiver);

  this.definition.applyScope(receiver, actualCond);

  var params = mergeQuery(actualCond, scopeParams);

  if (params.where && Object.keys(params.where).length > 0) { // TODO [fabien] Support order/sorting
    embeddedList = embeddedList ? embeddedList.filter(applyFilter(params)) : embeddedList;
  }

  var returnRelated = function(list) {
    if (params.include) {
      modelTo.include(list, params.include, options, cb);
    } else {
      process.nextTick(function() { cb(null, list); });
    }
  };

  returnRelated(embeddedList);
};

EmbedsMany.prototype.findById = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // order.emails(fkId, cb)
    cb = options;
    options = {};
  }
  var pk = this.definition.keyTo;
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;

  var embeddedList = this.embeddedList();

  var find = function(id) {
    for (var i = 0; i < embeddedList.length; i++) {
      var item = embeddedList[i];
      if (item[pk].toString() === id) return item;
    }
    return null;
  };

  var item = find(fkId.toString()); // in case of explicit id
  item = (item instanceof modelTo) ? item : null;

  if (typeof cb === 'function') {
    process.nextTick(function() {
      cb(null, item);
    });
  };

  return item; // sync
};

EmbedsMany.prototype.exists = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.emails.exists(fkId, cb)
    cb = options;
    options = {};
  }
  var modelTo = this.definition.modelTo;
  var inst = this.findById(fkId, options, function (err, inst) {
    if (cb) cb(err, inst instanceof modelTo);
  });
  return inst instanceof modelTo; // sync
};

EmbedsMany.prototype.updateById = function (fkId, data, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.emails.updateById(fkId, data, cb)
    cb = options;
    options = {};
  }
  if (typeof data === 'function') {
    // customer.emails.updateById(fkId, cb)
    cb = data;
    data = {};
  }

  var modelTo = this.definition.modelTo;
  var propertyName = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  var embeddedList = this.embeddedList();

  var inst = this.findById(fkId);

  if (inst instanceof modelTo) {
    if (typeof data === 'object') {
        inst.setAttributes(data);
    }
    var err = inst.isValid() ? null : new ValidationError(inst);
    if (err && typeof cb === 'function') {
      return process.nextTick(function() {
        cb(err, inst);
      });
    }

    if (typeof cb === 'function') {
      modelInstance.updateAttribute(propertyName,
        embeddedList, options, function(err) {
        cb(err, inst);
      });
    }
  } else if (typeof cb === 'function') {
    process.nextTick(function() {
      cb(null, null); // not found
    });
  }
  return inst; // sync
};

EmbedsMany.prototype.destroyById = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.emails.destroyById(fkId, cb)
    cb = options;
    options = {};
  }
  var modelTo = this.definition.modelTo;
  var propertyName = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  var embeddedList = this.embeddedList();

  var inst = (fkId instanceof modelTo) ? fkId : this.findById(fkId);

  if (inst instanceof modelTo) {
    var index = embeddedList.indexOf(inst);
    if (index > -1) embeddedList.splice(index, 1);
    if (typeof cb === 'function') {
      modelInstance.updateAttribute(propertyName,
        embeddedList, function(err) {
        cb(err);
        modelTo.emit('deleted', inst.id, inst.toJSON());
      });
    }
  } else if (typeof cb === 'function') {
    process.nextTick(cb); // not found
  }
  return inst; // sync
};

EmbedsMany.prototype.destroyAll = function(where, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.emails.destroyAll(where, cb);
    cb = options;
    options = {};
  } else if (typeof where === 'function' &&
    options === undefined && cb === undefined) {
    // customer.emails.destroyAll(cb);
    cb = where;
    where = {};
  }
  var propertyName = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  var embeddedList = this.embeddedList();

  if (where && Object.keys(where).length > 0) {
    var filter = applyFilter({ where: where });
    var reject = function(v) { return !filter(v) };
    embeddedList = embeddedList ? embeddedList.filter(reject) : embeddedList;
  } else {
    embeddedList = [];
  }

  if (typeof cb === 'function') {
    modelInstance.updateAttribute(propertyName,
      embeddedList, function(err) {
      cb(err);
    });
  } else {
    modelInstance.setAttribute(propertyName, embeddedList);
  }
};

EmbedsMany.prototype.get = EmbedsMany.prototype.findById;
EmbedsMany.prototype.set = EmbedsMany.prototype.updateById;
EmbedsMany.prototype.unset = EmbedsMany.prototype.destroyById;

EmbedsMany.prototype.at = function (index, cb) {
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;

  var embeddedList = this.embeddedList();

  var item = embeddedList[parseInt(index)];
  item = (item instanceof modelTo) ? item : null;

  if (typeof cb === 'function') {
    process.nextTick(function() {
      cb(null, item);
    });
  };

  return item; // sync
};

EmbedsMany.prototype.create = function (targetModelData, options, cb) {
  var pk = this.definition.keyTo;
  var modelTo = this.definition.modelTo;
  var propertyName = this.definition.keyFrom;
  var modelInstance = this.modelInstance;

  if (typeof options === 'function' && cb === undefined) {
    // customer.emails.create(cb)
    cb = options;
    options = {};
  }

  if (typeof targetModelData === 'function' && !cb) {
    cb = targetModelData;
    targetModelData = {};
  }
  targetModelData = targetModelData || {};
  cb = cb || utils.createPromiseCallback();

  var embeddedList = this.embeddedList();

  var inst = this.callScopeMethod('build', targetModelData);

  var updateEmbedded = function() {
    if (modelInstance.isNewRecord()) {
      modelInstance.setAttribute(propertyName, embeddedList);
      modelInstance.save(options, function(err) {
          cb(err, err ? null : inst);
      });
    } else {
      modelInstance.updateAttribute(propertyName,
        embeddedList, options, function(err) {
        cb(err, err ? null : inst);
      });
    }
  };

  if (this.definition.options.persistent) {
    inst.save(function(err) { // will validate
      if (err) return cb(err, inst);
      updateEmbedded();
    });
  } else {
    var err = inst.isValid() ? null : new ValidationError(inst);
    if (err) {
      process.nextTick(function() {
        cb(err);
      });
    } else {
      updateEmbedded();
    }
  }
  return cb.promise;
};

EmbedsMany.prototype.build = function(targetModelData) {
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;
  var forceId = this.definition.options.forceId;
  var persistent = this.definition.options.persistent;
  var connector = modelTo.dataSource.connector;

  var pk = this.definition.keyTo;
  var pkProp = modelTo.definition.properties[pk];
  var pkType = pkProp && pkProp.type;

  var embeddedList = this.embeddedList();

  targetModelData = targetModelData || {};

  var assignId = (forceId || targetModelData[pk] === undefined);
  assignId = assignId && !persistent;

  if (assignId && pkType === Number) {
    var ids = embeddedList.map(function(m) {
      return (typeof m[pk] === 'number' ? m[pk] : 0);
    });
    if (ids.length > 0) {
      targetModelData[pk] = Math.max.apply(null, ids) + 1;
    } else {
      targetModelData[pk] = 1;
    }
  } else if (assignId && typeof connector.generateId === 'function') {
      var id = connector.generateId(modelTo.modelName, targetModelData, pk);
      targetModelData[pk] = id;
  }

  this.definition.applyProperties(modelInstance, targetModelData);

  var inst = new modelTo(targetModelData);

  if (this.definition.options.prepend) {
    embeddedList.unshift(inst);
  } else {
    embeddedList.push(inst);
  }

  this.prepareEmbeddedInstance(inst);

  return inst;
};

/**
 * Add the target model instance to the 'embedsMany' relation
 * @param {Object|ID} acInst The actual instance or id value
 */
EmbedsMany.prototype.add = function (acInst, data, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.emails.add(acInst, data, cb)
    cb = options;
    options = {};
  } else if (typeof data === 'function' &&
    options === undefined && cb === undefined) {
    // customer.emails.add(acInst, cb)
    cb = data;
    data = {};
  }
  cb = cb || utils.createPromiseCallback();

  var self = this;
  var definition = this.definition;
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;

  var options = definition.options;
  var belongsTo = options.belongsTo && modelTo.relations[options.belongsTo];

  if (!belongsTo) {
    throw new Error('Invalid reference: ' + options.belongsTo || '(none)');
  }

  var fk2 = belongsTo.keyTo;
  var pk2 = belongsTo.modelTo.definition.idName() || 'id';

  var query = {};

  query[fk2] = (acInst instanceof belongsTo.modelTo) ? acInst[pk2] : acInst;

  var filter = { where: query };

  belongsTo.applyScope(modelInstance, filter);

  belongsTo.modelTo.findOne(filter, options, function(err, ref) {
    if (ref instanceof belongsTo.modelTo) {
      var inst = self.build(data || {});
      inst[options.belongsTo](ref);
      modelInstance.save(function(err) {
        cb(err, err ? null : inst);
      });
    } else {
      cb(null, null);
    }
  });
  return cb.promise;
};

/**
 * Remove the target model instance from the 'embedsMany' relation
 * @param {Object|ID) acInst The actual instance or id value
 */
EmbedsMany.prototype.remove = function (acInst, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.emails.remove(acInst, cb)
    cb = options;
    options = {};
  }
  var self = this;
  var definition = this.definition;
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;

  var options = definition.options;
  var belongsTo = options.belongsTo && modelTo.relations[options.belongsTo];

  if (!belongsTo) {
    throw new Error('Invalid reference: ' + options.belongsTo || '(none)');
  }

  var fk2 = belongsTo.keyTo;
  var pk2 = belongsTo.modelTo.definition.idName() || 'id';

  var query = {};

  query[fk2] = (acInst instanceof belongsTo.modelTo) ? acInst[pk2] : acInst;

  var filter = { where: query };

  belongsTo.applyScope(modelInstance, filter);

  cb = cb || utils.createPromiseCallback();

  modelInstance[definition.name](filter, options, function(err, items) {
    if (err) return cb(err);

    items.forEach(function(item) {
      self.unset(item);
    });

    modelInstance.save(options, function(err) {
      cb(err);
    });
  });
  return cb.promise;
};

RelationDefinition.referencesMany = function referencesMany(modelFrom, modelTo, params) {
  params = params || {};
  modelTo = lookupModelTo(modelFrom, modelTo, params, true);

  var thisClassName = modelFrom.modelName;
  var relationName = params.as || i8n.camelize(modelTo.pluralModelName, true);
  var fk = params.foreignKey || i8n.camelize(modelTo.modelName + '_ids', true);
  var idName = modelTo.dataSource.idName(modelTo.modelName) || 'id';
  var idType = modelTo.definition.properties[idName].type;

  var definition = modelFrom.relations[relationName] = new RelationDefinition({
    name: relationName,
    type: RelationTypes.referencesMany,
    modelFrom: modelFrom,
    keyFrom: fk,
    keyTo: idName,
    modelTo: modelTo,
    multiple: true,
    properties: params.properties,
    scope: params.scope,
    options: params.options
  });

  modelFrom.dataSource.defineProperty(modelFrom.modelName, fk, {
    type: [idType], default: function() { return []; }
  });

  modelFrom.validate(relationName, function(err) {
    var ids = this[fk] || [];
    var uniqueIds = ids.filter(function(id, pos) {
        return ids.indexOf(id) === pos;
    });
    if (ids.length !== uniqueIds.length) {
      var msg = 'contains duplicate `' + modelTo.modelName + '` instance';
      this.errors.add(relationName, msg, 'uniqueness');
      err(false);
    }
  }, { code: 'uniqueness' })

  var scopeMethods = {
    findById: scopeMethod(definition, 'findById'),
    destroy: scopeMethod(definition, 'destroyById'),
    updateById: scopeMethod(definition, 'updateById'),
    exists: scopeMethod(definition, 'exists'),
    add: scopeMethod(definition, 'add'),
    remove: scopeMethod(definition, 'remove'),
    at: scopeMethod(definition, 'at')
  };

  var findByIdFunc = scopeMethods.findById;
  modelFrom.prototype['__findById__' + relationName] = findByIdFunc;

  var destroyByIdFunc = scopeMethods.destroy;
  modelFrom.prototype['__destroyById__' + relationName] = destroyByIdFunc;

  var updateByIdFunc = scopeMethods.updateById;
  modelFrom.prototype['__updateById__' + relationName] = updateByIdFunc;

  var addFunc = scopeMethods.add;
  modelFrom.prototype['__link__' + relationName] = addFunc;

  var removeFunc = scopeMethods.remove;
  modelFrom.prototype['__unlink__' + relationName] = removeFunc;

  scopeMethods.create = scopeMethod(definition, 'create');
  scopeMethods.build = scopeMethod(definition, 'build');

  scopeMethods.related = scopeMethod(definition, 'related');

  var customMethods = extendScopeMethods(definition, scopeMethods, params.scopeMethods);

  for (var i = 0; i < customMethods.length; i++) {
    var methodName = customMethods[i];
    var method = scopeMethods[methodName];
    if (typeof method === 'function' && method.shared === true) {
      modelFrom.prototype['__' + methodName + '__' + relationName] = method;
    }
  };

  // Mix the property and scoped methods into the prototype class
  var scopeDefinition = defineScope(modelFrom.prototype, modelTo, relationName, function () {
    return {};
  }, scopeMethods, definition.options);

  scopeDefinition.related = scopeMethods.related; // bound to definition

  return definition;
};

ReferencesMany.prototype.related = function(receiver, scopeParams, condOrRefresh, options, cb) {
  var fk = this.definition.keyFrom;
  var modelTo = this.definition.modelTo;
  var relationName = this.definition.name;
  var modelInstance = this.modelInstance;
  var self = receiver;

  var actualCond = {};
  var actualRefresh = false;

  if (typeof condOrRefresh === 'function' &&
    options === undefined && cb === undefined) {
    // customer.orders(receiver, scopeParams, cb)
    cb = condOrRefresh;
    condOrRefresh = undefined;
  } else if (typeof options === 'function' && cb === undefined) {
    // customer.orders(receiver, scopeParams, condOrRefresh, cb)
    cb = options;
    options = {};
    if (typeof condOrRefresh === 'boolean') {
      actualRefresh = condOrRefresh;
      condOrRefresh = {};
    } else {
      actualRefresh = true;
    }
  }
  actualCond = condOrRefresh || {};

  var ids = self[fk] || [];

  this.definition.applyScope(modelInstance, actualCond);

  var params = mergeQuery(actualCond, scopeParams);
  return modelTo.findByIds(ids, params, options, cb);
};

ReferencesMany.prototype.findById = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.findById(fkId, cb)
    cb = options;
    options = {};
  }
  var modelTo = this.definition.modelTo;
  var modelFrom = this.definition.modelFrom;
  var relationName = this.definition.name;
  var modelInstance = this.modelInstance;

  var pk = this.definition.keyTo;
  var fk = this.definition.keyFrom;

  if (typeof fkId === 'object') {
    fkId = fkId.toString(); // mongodb
  }

  var ids = [fkId];

  var filter = {};

  this.definition.applyScope(modelInstance, filter);

  cb = cb || utils.createPromiseCallback();

  modelTo.findByIds(ids, filter, options, function (err, instances) {
    if (err) {
      return cb(err);
    }

    var inst = instances[0];
    if (!inst) {
      err = new Error('No instance with id ' + fkId + ' found for ' + modelTo.modelName);
      err.statusCode = 404;
      return cb(err);
    }

    var currentIds = ids.map(function(id) { return id.toString(); });
    var id = (inst[pk] || '').toString(); // mongodb

    // Check if the foreign key is amongst the ids
    if (currentIds.indexOf(id) > -1) {
      cb(null, inst);
    } else {
      err = new Error('Key mismatch: ' + modelFrom.modelName + '.' + fk
        + ': ' + modelInstance[fk]
        + ', ' + modelTo.modelName + '.' + pk + ': ' + inst[pk]);
      err.statusCode = 400;
      cb(err);
    }
  });
  return cb.promise;
};

ReferencesMany.prototype.exists = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.exists(fkId, cb)
    cb = options;
    options = {};
  }
  var fk = this.definition.keyFrom;
  var ids = this.modelInstance[fk] || [];
  var currentIds = ids.map(function(id) { return id.toString(); });
  var fkId = (fkId || '').toString(); // mongodb

  cb = cb || utils.createPromiseCallback();
  process.nextTick(function() { cb(null, currentIds.indexOf(fkId) > -1) });
  return cb.promise;
};

ReferencesMany.prototype.updateById = function (fkId, data, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.updateById(fkId, data, cb)
    cb = options;
    options = {};
  } else if (typeof data === 'function' &&
    options === undefined && cb === undefined) {
    // customer.orders.updateById(fkId, cb)
    cb = data;
    data = {};
  }
  cb = cb || utils.createPromiseCallback();

  this.findById(fkId, options, function(err, inst) {
    if (err) return cb(err);
    inst.updateAttributes(data, options, cb);
  });
  return cb.promise;
};

ReferencesMany.prototype.destroyById = function (fkId, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.destroyById(fkId, cb)
    cb = options;
    options = {};
  }
  var self = this;
  cb = cb || utils.createPromiseCallback();
  this.findById(fkId, function(err, inst) {
    if (err) return cb(err);
    self.remove(inst, function(err, ids) {
      inst.destroy(cb);
    });
  });
  return cb.promise;
};

ReferencesMany.prototype.at = function (index, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.at(index, cb)
    cb = options;
    options = {};
  }
  var fk = this.definition.keyFrom;
  var ids = this.modelInstance[fk] || [];
  cb = cb || utils.createPromiseCallback();
  this.findById(ids[index], options, cb);
  return cb.promise;
};

ReferencesMany.prototype.create = function (targetModelData, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.create(data, cb)
    cb = options;
    options = {};
  }
  var definition = this.definition;
  var modelTo = this.definition.modelTo;
  var relationName = this.definition.name;
  var modelInstance = this.modelInstance;

  var pk = this.definition.keyTo;
  var fk = this.definition.keyFrom;

  if (typeof targetModelData === 'function' && !cb) {
    cb = targetModelData;
    targetModelData = {};
  }
  targetModelData = targetModelData || {};
  cb = cb || utils.createPromiseCallback();

  var ids = modelInstance[fk] || [];

  var inst = this.callScopeMethod('build', targetModelData);

  inst.save(options, function(err, inst) {
    if (err) return cb(err, inst);

    var id = inst[pk];

    if (typeof id === 'object') {
      id = id.toString(); // mongodb
    }

    if (definition.options.prepend) {
      ids.unshift(id);
    } else {
      ids.push(id);
    }

    modelInstance.updateAttribute(fk,
      ids, options, function(err, modelInst) {
      cb(err, inst);
    });
  });
  return cb.promise;
};

ReferencesMany.prototype.build = function(targetModelData) {
  var modelTo = this.definition.modelTo;
  targetModelData = targetModelData || {};

  this.definition.applyProperties(this.modelInstance, targetModelData);

  return new modelTo(targetModelData);
};

/**
 * Add the target model instance to the 'embedsMany' relation
 * @param {Object|ID} acInst The actual instance or id value
 */
ReferencesMany.prototype.add = function (acInst, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.add(acInst, cb)
    cb = options;
    options = {};
  }
  var self = this;
  var definition = this.definition;
  var modelTo = this.definition.modelTo;
  var modelInstance = this.modelInstance;

  var pk = this.definition.keyTo;
  var fk = this.definition.keyFrom;

  var insert = function(inst, done) {
    var id = inst[pk];

    if (typeof id === 'object') {
      id = id.toString(); // mongodb
    }

    var ids = modelInstance[fk] || [];

    if (definition.options.prepend) {
      ids.unshift(id);
    } else {
      ids.push(id);
    }

    modelInstance.updateAttribute(fk, ids, options, function(err) {
      done(err, err ? null : inst);
    });
  };

  cb = cb || utils.createPromiseCallback();

  if (acInst instanceof modelTo) {
    insert(acInst, cb);
  } else {
    var filter = { where: {} };
    filter.where[pk] = acInst;

    definition.applyScope(modelInstance, filter);

    modelTo.findOne(filter, options, function (err, inst) {
      if (err || !inst) return cb(err, null);
      insert(inst, cb);
    });
  }
  return cb.promise;
};

/**
 * Remove the target model instance from the 'embedsMany' relation
 * @param {Object|ID) acInst The actual instance or id value
 */
ReferencesMany.prototype.remove = function (acInst, options, cb) {
  if (typeof options === 'function' && cb === undefined) {
    // customer.orders.remove(acInst, cb)
    cb = options;
    options = {};
  }
  var definition = this.definition;
  var modelInstance = this.modelInstance;

  var pk = this.definition.keyTo;
  var fk = this.definition.keyFrom;

  var ids = modelInstance[fk] || [];

  var currentIds = ids.map(function(id) { return id.toString(); });

  var id = (acInst instanceof definition.modelTo) ? acInst[pk] : acInst;
  id = id.toString();

  cb = cb || utils.createPromiseCallback();

  var index = currentIds.indexOf(id);
  if (index > -1) {
    ids.splice(index, 1);
    modelInstance.updateAttribute(fk, ids, options, function(err, inst) {
      cb(err, inst[fk] || []);
    });
  } else {
    process.nextTick(function() { cb(null, ids); });
  }
  return cb.promise;
};
