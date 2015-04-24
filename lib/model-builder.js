/*!
 * Module dependencies
 */

var inflection = require('inflection');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var assert = require('assert');
var deprecated = require('depd')('loopback-datasource-juggler');
var DefaultModelBaseClass = require('./model.js');
var List = require('./list.js');
var ModelDefinition = require('./model-definition.js');
var mergeSettings = require('./utils').mergeSettings;
var MixinProvider = require('./mixins');

// Set up types
require('./types')(ModelBuilder);

var introspect = require('./introspection')(ModelBuilder);

/*!
 * Export public API
 */
exports.ModelBuilder = exports.Schema = ModelBuilder;

/*!
 * Helpers
 */
var slice = Array.prototype.slice;

/**
 * ModelBuilder - A builder to define data models.
 *
 * @property {Object} definitions Definitions of the models.
 * @property {Object} models Model constructors
 * @class
 */
function ModelBuilder() {
  // create blank models pool
  this.models = {};
  this.definitions = {};
  this.mixins = new MixinProvider(this);
  this.defaultModelBaseClass = DefaultModelBaseClass;
}

// Inherit from EventEmitter
util.inherits(ModelBuilder, EventEmitter);

// Create a default instance
ModelBuilder.defaultInstance = new ModelBuilder();

function isModelClass(cls) {
  if (!cls) {
    return false;
  }
  return cls.prototype instanceof DefaultModelBaseClass;
}

/**
 * Get a model by name.
 *
 * @param {String} name The model name
 * @param {Boolean} forceCreate Whether the create a stub for the given name if a model doesn't exist.
 * @returns {*} The model class
 */
ModelBuilder.prototype.getModel = function (name, forceCreate) {
  var model = this.models[name];
  if (!model && forceCreate) {
    model = this.define(name, {}, {unresolved: true});
  }
  return model;
};

/**
 * Get the model definition by name
 * @param {String} name The model name
 * @returns {ModelDefinition} The model definition
 */
ModelBuilder.prototype.getModelDefinition = function (name) {
  return this.definitions[name];
};

/**
 * Define a model class.
 * Simple example:
 * ```
 * var User = modelBuilder.define('User', {
 *     email: String,
 *     password: String,
 *     birthDate: Date,
 *     activated: Boolean
 * });
 * ```
 * More advanced example:
 * ```
 * var User = modelBuilder.define('User', {
 *     email: { type: String, limit: 150, index: true },
 *     password: { type: String, limit: 50 },
 *     birthDate: Date,
 *     registrationDate: {type: Date, default: function () { return new Date }},
 *     activated: { type: Boolean, default: false }
 * });
 * ```
 *
 * @param {String} className Name of class
 * @param {Object} properties Hash of class properties in format `{property: Type, property2: Type2, ...}` or `{property: {type: Type}, property2: {type: Type2}, ...}`
 * @param {Object} settings Other configuration of class
 * @param {Function} parent Parent model
 * @return newly created class
 *
 */
ModelBuilder.prototype.define = function defineClass(className, properties, settings, parent) {
  var modelBuilder = this;
  var args = slice.call(arguments);
  var pluralName = (settings && settings.plural) ||
    inflection.pluralize(className);

  var httpOptions = (settings && settings.http) || {};
  var pathName = httpOptions.path || pluralName;

  if (!className) {
    throw new Error('Class name required');
  }
  if (args.length === 1) {
    properties = {};
    args.push(properties);
  }
  if (args.length === 2) {
    settings = {};
    args.push(settings);
  }

  properties = properties || {};
  settings = settings || {};

  // Set the strict mode to be false by default
  if (settings.strict === undefined || settings.strict === null) {
    settings.strict = false;
  }

  // Set up the base model class
  var ModelBaseClass = parent || this.defaultModelBaseClass;
  var baseClass = settings.base || settings['super'];
  if (baseClass) {
    // Normalize base model property
    settings.base = baseClass;
    delete settings['super'];

    if (isModelClass(baseClass)) {
      ModelBaseClass = baseClass;
    } else {
      ModelBaseClass = this.models[baseClass];
      assert(ModelBaseClass, 'Base model is not found: ' + baseClass);
    }
  }

  // Make sure base properties are inherited
  // See https://github.com/strongloop/loopback-datasource-juggler/issues/293
  if ((parent && !settings.base) || (!parent && settings.base)) {
    return ModelBaseClass.extend(className, properties, settings);
  }

  // Check if there is a unresolved model with the same name
  var ModelClass = this.models[className];

  // Create the ModelClass if it doesn't exist or it's resolved (override)
  // TODO: [rfeng] We need to decide what names to use for built-in models such as User.
  if (!ModelClass || !ModelClass.settings.unresolved) {
    // every class can receive hash of data as optional param
    ModelClass = function ModelConstructor(data, options) {
      if (!(this instanceof ModelConstructor)) {
        return new ModelConstructor(data, options);
      }
      if (ModelClass.settings.unresolved) {
        throw new Error('Model ' + ModelClass.modelName + ' is not defined.');
      }
      ModelBaseClass.apply(this, arguments);
    };
    // mix in EventEmitter (don't inherit from)
    var events = new EventEmitter();
    // The model can have more than 10 listeners for lazy relationship setup
    // See https://github.com/strongloop/loopback/issues/404
    events.setMaxListeners(32);
    for (var f in EventEmitter.prototype) {
      if (typeof EventEmitter.prototype[f] === 'function') {
        if (f !== 'on') {
          ModelClass[f] = EventEmitter.prototype[f].bind(events);
          continue;
        }

        // report deprecation warnings at the time Model.on() is called
        ModelClass.on = function(event) {
          if (['changed', 'deleted', 'deletedAll'].indexOf(event) !== -1) {
            deprecated(this.modelName + '\'s event "' + event + '" ' +
              'is deprecated, use Operation hooks instead. ' +
              'http://docs.strongloop.com/display/LB/Operation+hooks');
          }
          EventEmitter.prototype.on.apply(events, arguments);
        };
      }
    }
    hiddenProperty(ModelClass, 'modelName', className);
  }

  util.inherits(ModelClass, ModelBaseClass);

  // store class in model pool
  this.models[className] = ModelClass;

  // Return the unresolved model
  if (settings.unresolved) {
    ModelClass.settings = {unresolved: true};
    return ModelClass;
  }

  // Add metadata to the ModelClass
  hiddenProperty(ModelClass, 'modelBuilder', modelBuilder);
  hiddenProperty(ModelClass, 'dataSource', null); // Keep for back-compatibility
  hiddenProperty(ModelClass, 'pluralModelName', pluralName);
  hiddenProperty(ModelClass, 'relations', {});
  if (pathName[0] !== '/') {
    // Support both flavors path: 'x' and path: '/x'
    pathName = '/' + pathName;
  }
  hiddenProperty(ModelClass, 'http', { path: pathName });
  hiddenProperty(ModelClass, 'base', ModelBaseClass);
  hiddenProperty(ModelClass, '_observers', {});

  // inherit ModelBaseClass static methods
  for (var i in ModelBaseClass) {
    // We need to skip properties that are already in the subclass, for example, the event emitter methods
    if (i !== '_mixins' && !(i in ModelClass)) {
      ModelClass[i] = ModelBaseClass[i];
    }
  }

  // Load and inject the model classes
  if (settings.models) {
    Object.keys(settings.models).forEach(function (m) {
      var model = settings.models[m];
      ModelClass[m] = typeof model === 'string' ? modelBuilder.getModel(model, true) : model;
    });
  }

  ModelClass.getter = {};
  ModelClass.setter = {};

  for (var p in properties) {
    // Remove properties that reverted by the subclass
    if (properties[p] === null || properties[p] === false) {
      // Hide the base property
      delete properties[p];
    }

    // Warn about properties with unsupported names
    if (/\./.test(p)) {
      deprecated('Property names containing a dot are not supported. ' +
        'Model: ' + className + ', property: ' + p);
    }
  }

  var modelDefinition = new ModelDefinition(this, className, properties, settings);

  this.definitions[className] = modelDefinition;

  // expose properties on the ModelClass
  ModelClass.definition = modelDefinition;
  // keep a pointer to settings as models can use it for configuration
  ModelClass.settings = modelDefinition.settings;

  var idInjection = settings.idInjection;
  if (idInjection !== false) {
    // Default to true if undefined
    idInjection = true;
  }

  var idNames = modelDefinition.idNames();
  if (idNames.length > 0) {
    // id already exists
    idInjection = false;
  }

  // Add the id property
  if (idInjection) {
    // Set up the id property
    ModelClass.definition.defineProperty('id', { type: Number, id: 1, generated: true });
  }

  idNames = modelDefinition.idNames(); // Reload it after rebuild
  // Create a virtual property 'id'
  if (idNames.length === 1) {
    var idProp = idNames[0];
    if (idProp !== 'id') {
      Object.defineProperty(ModelClass.prototype, 'id', {
        get: function () {
          var idProp = ModelClass.definition.idNames()[0];
          return this.__data[idProp];
        },
        configurable: true,
        enumerable: false
      });
    }
  } else {
    // Now the id property is an object that consists of multiple keys
    Object.defineProperty(ModelClass.prototype, 'id', {
      get: function () {
        var compositeId = {};
        var idNames = ModelClass.definition.idNames();
        for (var i = 0, p; i < idNames.length; i++) {
          p = idNames[i];
          compositeId[p] = this.__data[p];
        }
        return compositeId;
      },
      configurable: true,
      enumerable: false
    });
  }

  // A function to loop through the properties
  ModelClass.forEachProperty = function (cb) {
    var props = ModelClass.definition.properties;
    var keys = Object.keys(props);
    for (var i = 0, n = keys.length; i < n; i++) {
      cb(keys[i], props[keys[i]]);
    }
  };

  // A function to attach the model class to a data source
  ModelClass.attachTo = function (dataSource) {
    dataSource.attach(this);
  };

  /** Extend the model with the specified model, properties, and other settings.
   * For example, to extend an existing model, for example, a built-in model:
   *
   * ```js
   * var Customer = User.extend('customer', {
   *   accountId: String,
   *   vip: Boolean
   * });
   * ```
   *
   * To extend the base model, essentially creating a new model:
   * ```js
   * var user = loopback.Model.extend('user', properties, options);
   * ```
   *
   * @param {String} className Name of the new model being defined.
   * @options {Object} properties Properties to define for the model, added to properties of model being extended.
   * @options {Object} settings Model settings, such as relations and acls.
   *
   */
  ModelClass.extend = function (className, subclassProperties, subclassSettings) {
    var properties = ModelClass.definition.properties;
    var settings = ModelClass.definition.settings;

    subclassProperties = subclassProperties || {};
    subclassSettings = subclassSettings || {};

    // Check if subclass redefines the ids
    var idFound = false;
    for (var k in subclassProperties) {
      if (subclassProperties[k] && subclassProperties[k].id) {
        idFound = true;
        break;
      }
    }

    // Merging the properties
    var keys = Object.keys(properties);
    for (var i = 0, n = keys.length; i < n; i++) {
      var key = keys[i];

      if (idFound && properties[key].id) {
        // don't inherit id properties
        continue;
      }
      if (subclassProperties[key] === undefined) {
        subclassProperties[key] = properties[key];
      }
    }

    // Merge the settings
    var originalSubclassSettings = subclassSettings;
    subclassSettings = mergeSettings(settings, subclassSettings);

    // Ensure 'base' is not inherited. Note we don't have to delete 'super'
    // as that is removed from settings by modelBuilder.define and thus
    // it is never inherited
    if (!originalSubclassSettings.base) {
      subclassSettings.base = ModelClass;
    }

    // Define the subclass
    var subClass = modelBuilder.define(className, subclassProperties, subclassSettings, ModelClass);

    // Calling the setup function
    if (typeof subClass.setup === 'function') {
      subClass.setup.call(subClass);
    }

    return subClass;
  };

  /**
   * Register a property for the model class
   * @param {String} propertyName Name of the property.
   */
  ModelClass.registerProperty = function (propertyName) {
    var properties = modelDefinition.build();
    var prop = properties[propertyName];
    var DataType = prop.type;
    if (!DataType) {
      throw new Error('Invalid type for property ' + propertyName);
    }

    if (prop.required) {
      var requiredOptions = typeof prop.required === 'object' ? prop.required : undefined;
      ModelClass.validatesPresenceOf(propertyName, requiredOptions);
    }

    Object.defineProperty(ModelClass.prototype, propertyName, {
      get: function () {
        if (ModelClass.getter[propertyName]) {
          return ModelClass.getter[propertyName].call(this); // Try getter first
        } else {
          return this.__data && this.__data[propertyName]; // Try __data
        }
      },
      set: function (value) {
        var DataType = ModelClass.definition.properties[propertyName].type;
        if (Array.isArray(DataType) || DataType === Array) {
          DataType = List;
        } else if (DataType === Date) {
          DataType = DateType;
        } else if (DataType === Boolean) {
          DataType = BooleanType;
        } else if (typeof DataType === 'string') {
          DataType = modelBuilder.resolveType(DataType);
        }

        var persistUndefinedAsNull = ModelClass.definition.settings.persistUndefinedAsNull;
        if (value === undefined && persistUndefinedAsNull) {
          value = null;
        }

        if (ModelClass.setter[propertyName]) {
          ModelClass.setter[propertyName].call(this, value); // Try setter first
        } else {
          this.__data = this.__data || {};
          if (value === null || value === undefined) {
            this.__data[propertyName] = value;
          } else {
            if (DataType === List) {
              this.__data[propertyName] = DataType(value, properties[propertyName].type, this.__data);
            } else {
              // Assume the type constructor handles Constructor() call
              // If not, we should call new DataType(value).valueOf();
              this.__data[propertyName] = (value instanceof DataType) ? value : DataType(value);
            }
          }
        }
      },
      configurable: true,
      enumerable: true
    });

    // FIXME: [rfeng] Do we need to keep the raw data?
    // Use $ as the prefix to avoid conflicts with properties such as _id
    Object.defineProperty(ModelClass.prototype, '$' + propertyName, {
      get: function () {
        return this.__data && this.__data[propertyName];
      },
      set: function (value) {
        if (!this.__data) {
          this.__data = {};
        }
        this.__data[propertyName] = value;
      },
      configurable: true,
      enumerable: false
    });
  };

  var props = ModelClass.definition.properties;
  var keys = Object.keys(props);
  var size = keys.length;
  for (i = 0; i < size; i++) {
    var propertyName = keys[i];
    ModelClass.registerProperty(propertyName);
  }

  var mixinSettings = settings.mixins || {};
  keys = Object.keys(mixinSettings);
  size = keys.length;
  for (i = 0; i < size; i++) {
    var name = keys[i];
    var mixin = mixinSettings[name];
    if (mixin === true) {
      mixin = {};
    }
    if (Array.isArray(mixin)) {
      mixin.forEach(function(m) {
        if (m === true) m = {};
        if (typeof m === 'object') {
          modelBuilder.mixins.applyMixin(ModelClass, name, m);
        }
      });
    } else if (typeof mixin === 'object') {
      modelBuilder.mixins.applyMixin(ModelClass, name, mixin);
    }
  }

  ModelClass.emit('defined', ModelClass);

  return ModelClass;

};

// DataType for Date
function DateType(arg) {
  var d = new Date(arg);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date: ' + arg);
  }
  return d;
}

// Relax the Boolean coercision
function BooleanType(arg) {
  if (typeof arg === 'string') {
    switch (arg) {
      case 'true':
      case '1':
        return true;
      case 'false':
      case '0':
        return false;
    }
  }
  if (arg == null) {
    return null;
  }
  return Boolean(arg);
}

/**
 * Define single property named `propertyName` on `model`
 *
 * @param {String} model Name of model
 * @param {String} propertyName Name of property
 * @param {Object} propertyDefinition Property settings
 */
ModelBuilder.prototype.defineProperty = function (model, propertyName, propertyDefinition) {
  this.definitions[model].defineProperty(propertyName, propertyDefinition);
  this.models[model].registerProperty(propertyName);
};

/**
 * Define a new value type that can be used in model schemas as a property type.
 * @param {function()} type Type constructor.
 * @param {string[]=} aliases Optional list of alternative names for this type.
 */
ModelBuilder.prototype.defineValueType = function(type, aliases) {
  ModelBuilder.registerType(type, aliases);
};

/**
 * Extend existing model with specified properties
 *
 * Example:
 * Instead of extending a model with attributes like this (for example):
 *
 * ```js
 *     db.defineProperty('Content', 'competitionType',
 *       { type: String });
 *     db.defineProperty('Content', 'expiryDate',
 *       { type: Date, index: true });
 *     db.defineProperty('Content', 'isExpired',
 *       { type: Boolean, index: true });
 *```
 * This method enables you to extend a model as follows (for example):
 * ```js
 *     db.extendModel('Content', {
 *       competitionType: String,
 *       expiryDate: { type: Date, index: true },
 *       isExpired: { type: Boolean, index: true }
 *     });
 *```
 *
 * @param {String} model Name of model
 * @options {Object} properties JSON object specifying properties.  Each property is a key whos value is
 * either the [type](http://docs.strongloop.com/display/LB/LoopBack+types) or `propertyName: {options}`
 * where the options are described below.
 * @property {String} type Datatype of property: Must be an [LDL type](http://docs.strongloop.com/display/LB/LoopBack+types).
 * @property {Boolean} index True if the property is an index; false otherwise.
 */
ModelBuilder.prototype.extendModel = function (model, props) {
  var t = this;
  var keys = Object.keys(props);
  for (var i = 0; i < keys.length; i++) {
    var definition = props[keys[i]];
    t.defineProperty(model, keys[i], definition);
  }
};

ModelBuilder.prototype.copyModel = function copyModel(Master) {
  var modelBuilder = this;
  var className = Master.modelName;
  var md = Master.modelBuilder.definitions[className];
  var Slave = function SlaveModel() {
    Master.apply(this, [].slice.call(arguments));
  };

  util.inherits(Slave, Master);

  Slave.__proto__ = Master;

  hiddenProperty(Slave, 'modelBuilder', modelBuilder);
  hiddenProperty(Slave, 'modelName', className);
  hiddenProperty(Slave, 'relations', Master.relations);

  if (!(className in modelBuilder.models)) {

    // store class in model pool
    modelBuilder.models[className] = Slave;
    modelBuilder.definitions[className] = {
      properties: md.properties,
      settings: md.settings
    };
  }

  return Slave;
};

/*!
 * Define hidden property
 */
function hiddenProperty(where, property, value) {
  Object.defineProperty(where, property, {
    writable: true,
    enumerable: false,
    configurable: true,
    value: value
  });
}

/**
 * Get the schema name
 */
ModelBuilder.prototype.getSchemaName = function (name) {
  if (name) {
    return name;
  }
  if (typeof this._nameCount !== 'number') {
    this._nameCount = 0;
  } else {
    this._nameCount++;
  }
  return 'AnonymousModel_' + this._nameCount;
};

/**
 * Resolve the type string to be a function, for example, 'String' to String.
 * Returns {Function} if the type is resolved
 * @param {String} type The type string, such as 'number', 'Number', 'boolean', or 'String'. It's case insensitive
 */
ModelBuilder.prototype.resolveType = function (type) {
  if (!type) {
    return type;
  }
  if (Array.isArray(type) && type.length > 0) {
    // For array types, the first item should be the type string
    var itemType = this.resolveType(type[0]);
    if (typeof itemType === 'function') {
      return [itemType];
    }
    else {
      return itemType; // Not resolved, return the type string
    }
  }
  if (typeof type === 'string') {
    var schemaType = ModelBuilder.schemaTypes[type.toLowerCase()] || this.models[type];
    if (schemaType) {
      return schemaType;
    } else {
      // The type cannot be resolved, let's create a place holder
      type = this.define(type, {}, {unresolved: true});
      return type;
    }
  } else if (type.constructor.name === 'Object') {
    // We also support the syntax {type: 'string', ...}
    if (type.type) {
      return this.resolveType(type.type);
    } else {
      return this.define(this.getSchemaName(null),
        type, {anonymous: true, idInjection: false});
    }
  } else if ('function' === typeof type) {
    return type;
  }
  return type;
};

/**
 * Build models from schema definitions
 *
 * `schemas` can be one of the following:
 *
 * 1. An array of named schema definition JSON objects
 * 2. A schema definition JSON object
 * 3. A list of property definitions (anonymous)
 *
 * @param {*} schemas The schemas
 * @returns {Object} A map of model constructors keyed by model name
 */
ModelBuilder.prototype.buildModels = function (schemas, createModel) {
  var models = {};

  // Normalize the schemas to be an array of the schema objects {name: <name>, properties: {}, options: {}}
  if (!Array.isArray(schemas)) {
    if (schemas.properties && schemas.name) {
      // Only one item
      schemas = [schemas];
    } else {
      // Anonymous schema
      schemas = [
        {
          name: this.getSchemaName(),
          properties: schemas,
          options: {anonymous: true}
        }
      ];
    }
  }

  var relations = [];
  for (var s = 0, n = schemas.length; s < n; s++) {
    var name = this.getSchemaName(schemas[s].name);
    schemas[s].name = name;
    var model;
    if(typeof createModel === 'function') {
      model = createModel(schemas[s].name, schemas[s].properties, schemas[s].options);
    } else {
      model = this.define(schemas[s].name, schemas[s].properties, schemas[s].options);
    }
    models[name] = model;
    relations = relations.concat(model.definition.relations);
  }

  // Connect the models based on the relations
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    var sourceModel = models[relation.source];
    var targetModel = models[relation.target];
    if (sourceModel && targetModel) {
      if (typeof sourceModel[relation.type] === 'function') {
        sourceModel[relation.type](targetModel, {as: relation.as});
      }
    }
  }
  return models;
};

/**
 * Introspect the JSON document to build a corresponding model.
 * @param {String} name The model name
 * @param {Object} json The JSON object
 * @param {Object} options The options
 * @returns {}
 */
ModelBuilder.prototype.buildModelFromInstance = function (name, json, options) {

  // Introspect the JSON document to generate a schema
  var schema = introspect(json);

  // Create a model for the generated schema
  return this.define(name, schema, options);
};



