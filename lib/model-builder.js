/*!
 * Module dependencies
 */

var inflection = require('inflection');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var DefaultModelBaseClass = require('./model.js');
var List = require('./list.js');
var ModelDefinition = require('./model-definition.js');

// Set up types
require('./types')(ModelBuilder);

var introspect = require('./introspection')(ModelBuilder);

/**
 * Export public API
 */
exports.ModelBuilder = exports.Schema = ModelBuilder;

/*!
 * Helpers
 */
var slice = Array.prototype.slice;

/**
 * ModelBuilder - A builder to define data models
 *
 * @constructor
 */
function ModelBuilder() {
    // create blank models pool
    /**
     * @property {Object} models Model constructors
     */
    this.models = {};
    /**
     * @property {Object} definitions Definitions of the models
     */
    this.definitions = {};
}

// Inherit from EventEmitter
util.inherits(ModelBuilder, EventEmitter);

// Create a default instance
ModelBuilder.defaultInstance = new ModelBuilder();

/**
 * Define a model class
 *
 * @param {String} className
 * @param {Object} properties - hash of class properties in format
 *   `{property: Type, property2: Type2, ...}`
 *   or
 *   `{property: {type: Type}, property2: {type: Type2}, ...}`
 * @param {Object} settings - other configuration of class
 * @return newly created class
 *
 * @example simple case
 * ```
 * var User = dataSource.define('User', {
 *     email: String,
 *     password: String,
 *     birthDate: Date,
 *     activated: Boolean
 * });
 * ```
 * @example more advanced case
 * ```
 * var User = dataSource.define('User', {
 *     email: { type: String, limit: 150, index: true },
 *     password: { type: String, limit: 50 },
 *     birthDate: Date,
 *     registrationDate: {type: Date, default: function () { return new Date }},
 *     activated: { type: Boolean, default: false }
 * });
 * ```
 */
ModelBuilder.prototype.define = function defineClass(className, properties, settings, parent) {
    var dataSource = this;
    var args = slice.call(arguments);
    var pluralName = settings && settings.plural;
    var ModelBaseClass = parent || DefaultModelBaseClass;

    if (!className) {
        throw new Error('Class name required');
    }
    if (args.length === 1) {
        properties = {};
        args.push(properties);
    }
    if (args.length === 2) {
        settings   = {};
        args.push(settings);
    }

    properties = properties || {};
    settings = settings || {};

    // Set the strict mode to be false by default
    if(settings.strict === undefined || settings.strict === null) {
        settings.strict = false;
    }

    // every class can receive hash of data as optional param
    var ModelClass = function ModelConstructor(data, dataSource) {
        if(!(this instanceof ModelConstructor)) {
            return new ModelConstructor(data, dataSource);
        }
        ModelBaseClass.apply(this, arguments);
        if(!this.dataSource) {
          hiddenProperty(this, 'dataSource', dataSource || this.constructor.dataSource);
        }
    };

    // mix in EventEmitter (don't inherit from)
    var events = new EventEmitter();
    for (var f in EventEmitter.prototype) {
        if (typeof EventEmitter.prototype[f] === 'function') {
            ModelClass[f] = events[f].bind(events);
        }
    }

    // Add metadata to the ModelClass
    hiddenProperty(ModelClass, 'dataSource', dataSource);
    hiddenProperty(ModelClass, 'schema', dataSource); // For backward compatibility
    hiddenProperty(ModelClass, 'modelName', className);
    hiddenProperty(ModelClass, 'pluralModelName', pluralName || inflection.pluralize(className));
    hiddenProperty(ModelClass, 'relations', {});
    
    util.inherits(ModelClass, ModelBaseClass);

    // inherit ModelBaseClass static methods
    for (var i in ModelBaseClass) {
      if(i !== '_mixins') {
        ModelClass[i] = ModelBaseClass[i];
      }
    }
    
    ModelClass.getter = {};
    ModelClass.setter = {};

    var modelDefinition = new ModelDefinition(this, className, properties, settings);
    // store class in model pool
    this.models[className] = ModelClass;
    this.definitions[className] = modelDefinition;
    
    // expose properties on the ModelClass
    ModelClass.definition = modelDefinition;
    // keep a pointer to settings as models can use it for configuration
    ModelClass.settings = modelDefinition.settings;

    var idInjection = settings.idInjection;
    if(idInjection !== false) {
        // Default to true if undefined
        idInjection = true;
    }

    var idNames = modelDefinition.idNames();
    if(idNames.length > 0) {
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
                    var idProp = ModelClass.definition.idNames[0];
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
                for (var p in idNames) {
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
        Object.keys(ModelClass.definition.properties).forEach(cb);
    };

    // A function to attach the model class to a data source
    ModelClass.attachTo = function (dataSource) {
        dataSource.attach(this);
    };

    // A function to extend the model
    ModelClass.extend = function (className, subclassProperties, subclassSettings) {
        var properties = ModelClass.definition.properties;
        var settings = ModelClass.definition.settings;

        subclassProperties = subclassProperties || {};
        subclassSettings = subclassSettings || {};

        // Check if subclass redefines the ids
        var idFound = false;
        for(var k in subclassProperties) {
            if(subclassProperties[k].id) {
                idFound = true;
                break;
            }
        }

        // Merging the properties
        Object.keys(properties).forEach(function (key) {
          if(idFound && properties[key].id) {
              // don't inherit id properties
              return;
          }
          if(subclassProperties[key] === undefined) {
            subclassProperties[key] = properties[key];
          }
        });

        // Merge the settings
        Object.keys(settings).forEach(function (key) {
          if(subclassSettings[key] === undefined) {
            subclassSettings[key] = settings[key];
          }
        });

        // Define the subclass
        var subClass = dataSource.define(className, subclassProperties, subclassSettings, ModelClass);

        // Calling the setup function
        if(typeof subClass.setup === 'function') {
          subClass.setup.call(subClass);
        }
        
        return subClass;
    };

    /**
     * Register a property for the model class
     * @param propertyName
     */
    ModelClass.registerProperty = function (propertyName) {
        var properties = modelDefinition.build();
        var prop = properties[propertyName];
        var DataType = prop.type;
        if(!DataType) {
            throw new Error('Invalid type for property ' + propertyName);
        }
        if (Array.isArray(DataType) || DataType === Array) {
            DataType = List;
        } else if (DataType.name === 'Date') {
            var OrigDate = Date;
            DataType = function Date(arg) {
                return new OrigDate(arg);
            };
        } else if(typeof DataType === 'string') {
            DataType = dataSource.resolveType(DataType);
        }
        
        if(prop.required) {
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
                if (ModelClass.setter[propertyName]) {
                    ModelClass.setter[propertyName].call(this, value); // Try setter first
                } else {
                    if (!this.__data) {
                        this.__data = {};
                    }
                    if (value === null || value === undefined) {
                        this.__data[propertyName] = value;
                    } else {
                        if(DataType === List) {
                            this.__data[propertyName] = DataType(value, properties[propertyName].type, this.__data);
                        } else {
                            // Assume the type constructor handles Constructor() call
                            // If not, we should call new DataType(value).valueOf();
                            this.__data[propertyName] = DataType(value);
                        }
                    }
                }
            },
            configurable: true,
            enumerable: true
        });

        // <propertyName>$was --> __dataWas.<propertyName>
        Object.defineProperty(ModelClass.prototype, propertyName + '$was', {
            get: function () {
                return this.__dataWas && this.__dataWas[propertyName];
            },
            configurable: true,
            enumerable: false
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

    ModelClass.forEachProperty(ModelClass.registerProperty);

    return ModelClass;

};

/**
 * Define single property named `propertyName` on `model`
 *
 * @param {String} model - name of model
 * @param {String} propertyName - name of property
 * @param {Object} propertyDefinition - property settings
 */
ModelBuilder.prototype.defineProperty = function (model, propertyName, propertyDefinition) {
    this.definitions[model].defineProperty(propertyName, propertyDefinition);
    this.models[model].registerProperty(propertyName);
};

/**
 * Extend existing model with bunch of properties
 *
 * @param {String} model - name of model
 * @param {Object} props - hash of properties
 *
 * Example:
 *
 *     // Instead of doing this:
 *
 *     // amend the content model with competition attributes
 *     db.defineProperty('Content', 'competitionType', { type: String });
 *     db.defineProperty('Content', 'expiryDate', { type: Date, index: true });
 *     db.defineProperty('Content', 'isExpired', { type: Boolean, index: true });
 *
 *     // dataSource.extend allows to
 *     // extend the content model with competition attributes
 *     db.extendModel('Content', {
 *       competitionType: String,
 *       expiryDate: { type: Date, index: true },
 *       isExpired: { type: Boolean, index: true }
 *     });
 */
ModelBuilder.prototype.extendModel = function (model, props) {
    var t = this;
    Object.keys(props).forEach(function (propName) {
        var definition = props[propName];
        t.defineProperty(model, propName, definition);
    });
};


ModelBuilder.prototype.copyModel = function copyModel(Master) {
    var dataSource = this;
    var className = Master.modelName;
    var md = Master.dataSource.definitions[className];
    var Slave = function SlaveModel() {
        Master.apply(this, [].slice.call(arguments));
        this.dataSource = dataSource;
    };

    util.inherits(Slave, Master);

    Slave.__proto__ = Master;

    hiddenProperty(Slave, 'dataSource', dataSource);
    hiddenProperty(Slave, 'modelName', className);
    hiddenProperty(Slave, 'relations', Master.relations);

    if (!(className in dataSource.models)) {

        // store class in model pool
        dataSource.models[className] = Slave;
        dataSource.definitions[className] = {
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
 * Resolve the type string to be a function, for example, 'String' to String
 * @param {String} type The type string, such as 'number', 'Number', 'boolean', or 'String'. It's case insensitive
 * @returns {Function} if the type is resolved
 */
ModelBuilder.prototype.resolveType = function(type) {
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
    } else if('function' === typeof type ) {
        return type;
    }
    return type;
};

/**
 * Build models from dataSource definitions
 *
 * `schemas` can be one of the following:
 *
 * 1. An array of named dataSource definition JSON objects
 * 2. A dataSource definition JSON object
 * 3. A list of property definitions (anonymous)
 *
 * @param {*} schemas The schemas
 * @returns {Object} A map of model constructors keyed by model name
 */
ModelBuilder.prototype.buildModels = function (schemas) {
    var models = {};

    // Normalize the schemas to be an array of the schema objects {name: <name>, properties: {}, options: {}}
    if (!Array.isArray(schemas)) {
        if (schemas.properties && schemas.name) {
            // Only one item
            schemas = [schemas];
        } else {
            // Anonymous dataSource
            schemas = [
                {
                    name: this.getSchemaName(),
                    properties: schemas,
                    options: {anonymous: true}
                }
            ];
        }
    }

    var associations = [];
    for (var s in schemas) {
        var name = this.getSchemaName(schemas[s].name);
        schemas[s].name = name;
        var model = this.define(schemas[s].name, schemas[s].properties, schemas[s].options);
        models[name] = model;
        associations = associations.concat(model.definition.associations);
    }

    // Connect the models based on the associations
    for (var i = 0; i < associations.length; i++) {
        var association = associations[i];
        var sourceModel = models[association.source];
        var targetModel = models[association.target];
        if (sourceModel && targetModel) {
            if(typeof sourceModel[association.relation] === 'function') {
                sourceModel[association.relation](targetModel, {as: association.as});
            }
        }
    }
    return models;
};

/**
 * Introspect the json document to build a corresponding model
 * @param {String} name The model name
 * @param {Object} json The json object
 * @param [Object} options The options
 * @returns {}
 */
ModelBuilder.prototype.buildModelFromInstance = function(name, json, options) {

    // Introspect the JSON document to generate a schema
    var schema = introspect(json);

    // Create a model for the generated schema
    return this.define(name, schema, options);
};



