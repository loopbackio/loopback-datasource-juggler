/*!
 * Module dependencies
 */

var i8n = require('inflection');
var DefaultModelBaseClass = require('./model.js');
var List = require('./list.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

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

util.inherits(ModelBuilder, EventEmitter);

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

    this.buildSchema(className, properties);

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
    
    // mix in EventEmitter (dont inherit from)
    var events = new EventEmitter();
    ModelClass.on = events.on.bind(events);
    ModelClass.once = events.once.bind(events);
    ModelClass.emit = events.emit.bind(events);
    ModelClass.setMaxListeners = events.setMaxListeners.bind(events);

    hiddenProperty(ModelClass, 'dataSource', dataSource);
    hiddenProperty(ModelClass, 'schema', dataSource); // For backward compatibility
    hiddenProperty(ModelClass, 'modelName', className);
    hiddenProperty(ModelClass, 'pluralModelName', pluralName || i8n.pluralize(className));
    hiddenProperty(ModelClass, 'relations', {});
    
    util.inherits(ModelClass, ModelBaseClass);

    // inherit ModelBaseClass static methods
    for (var i in ModelBaseClass) {
        ModelClass[i] = ModelBaseClass[i];
    }
    
    ModelClass.getter = {};
    ModelClass.setter = {};
    standartize(properties, settings);

    // store class in model pool
    this.models[className] = ModelClass;
    this.definitions[className] = {
        properties: properties,
        settings: settings
    };
    
    // expose properties on the ModelClass
    ModelClass.properties = properties;
    ModelClass.settings = settings;

    var idInjection = settings.idInjection;
    if(idInjection !== false) {
        idInjection = true;
    }
    for(var p in properties) {
        if(properties[p].id) {
            idInjection = false;
            ModelClass.prototype.__defineGetter__('id', function () {
                return this.__data[p];
            });
            break;
        }
    }
    // Add the id property
    if (idInjection) {
      
        ModelClass.prototype.__defineGetter__('id', function () {
            return this.__data.id;
        });

        // Set up the id property
        properties.id = properties.id || { type: Number, id: 1, generated: true };
        if (!properties.id.id) {
            properties.id.id = 1;
        }
    }

    ModelClass.forEachProperty = function (cb) {
        Object.keys(properties).forEach(cb);
    };

    ModelClass.attachTo = function (dataSource) {
        dataSource.attach(this);
    };
    
    ModelClass.extend = function (className, p, s) {
        p = p || {};
        s = s || {};
        
        
        Object.keys(properties).forEach(function (key) {
          // dont inherit the id property
          if(key !== 'id' && typeof p[key] === 'undefined') {
            p[key] = properties[key];
          }
        });
        
        Object.keys(settings).forEach(function (key) {
          if(typeof s[key] === 'undefined') {
            s[key] = settings[key];
          }
        });
        
        var c = dataSource.define(className, p, s, ModelClass);
        
        if(typeof c.setup === 'function') {
          c.setup.call(c);
        }
        
        return c;
    };

    ModelClass.registerProperty = function (attr) {
        var prop = properties[attr];
        var DataType = prop.type;
        if(!DataType) {
            throw new Error('Invalid type for property ' + attr);
        }
        if (Array.isArray(DataType) || DataType === Array) {
            DataType = List;
        } else if (DataType.name === 'Date') {
            var OrigDate = Date;
            DataType = function Date(arg) {
                return new OrigDate(arg);
            };
        } else if(typeof DataType === 'string') {
            DataType = dataSource.getSchemaType(DataType);
        }
        
        if(prop.required) {
            var requiredOptions = typeof prop.required === 'object' ? prop.required : undefined;
            ModelClass.validatesPresenceOf(attr, requiredOptions);
        }

        Object.defineProperty(ModelClass.prototype, attr, {
            get: function () {
                if (ModelClass.getter[attr]) {
                    return ModelClass.getter[attr].call(this);
                } else {
                    return this.__data && this.__data[attr];
                }
            },
            set: function (value) {
                if (ModelClass.setter[attr]) {
                    ModelClass.setter[attr].call(this, value);
                } else {
                    if (!this.__data) {
                        this.__data = {};
                    }
                    if (value === null || value === undefined) {
                        this.__data[attr] = value;
                    } else {
                        if(DataType === List) {
                            this.__data[attr] = DataType(value, properties[attr].type, this.__data);
                        } else {
                            // Assume the type constructor handles Constructor() call
                            // If not, we should call new DataType(value).valueOf();
                            this.__data[attr] = DataType(value);
                        }
                    }
                }
            },
            configurable: true,
            enumerable: true
        });

        ModelClass.prototype.__defineGetter__(attr + '_was', function () {
            return this.__dataWas && this.__dataWas[attr];
        });

        // FIXME: [rfeng] Do we need to keep the raw data?
        // Use $ as the prefix to avoid conflicts with properties such as _id
        Object.defineProperty(ModelClass.prototype, '$' + attr, {
            get: function () {
                return this.__data && this.__data[attr];
            },
            set: function (value) {
                if (!this.__data) {
                    this.__data = {};
                }
                this.__data[attr] = value;
            },
            configurable: true,
            enumerable: false
        });
    };

    ModelClass.forEachProperty(ModelClass.registerProperty);

    return ModelClass;

};

function standartize(properties, settings) {
    Object.keys(properties).forEach(function (key) {
        var v = properties[key];
        if (typeof v === 'function' || Array.isArray(v)) {
            properties[key] = { type: v };
        }
    });
    // TODO: add timestamps fields
    // when present in settings: {timestamps: true}
    // or {timestamps: {created: 'created_at', updated: false}}
    // by default property names: createdAt, updatedAt
}

/**
 * Define single property named `prop` on `model`
 *
 * @param {String} model - name of model
 * @param {String} prop - name of property
 * @param {Object} params - property settings
 */
ModelBuilder.prototype.defineProperty = function (model, prop, params) {
    this.definitions[model].properties[prop] = params;
    this.models[model].registerProperty(prop);
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
    standartize(props, {});
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

/*!
 * Define readonly property on object
 *
 * @param {Object} obj
 * @param {String} key
 * @param {Mixed} value
 */
function defineReadonlyProp(obj, key, value) {
    Object.defineProperty(obj, key, {
        writable: false,
        enumerable: true,
        configurable: true,
        value: value
    });
}

/**
 * Resolve the type string to be a function, for example, 'String' to String
 * @param {String} type The type string, such as 'number', 'Number', 'boolean', or 'String'. It's case insensitive
 * @returns {Function} if the type is resolved
 */
ModelBuilder.prototype.getSchemaType = function(type) {
    if (!type) {
        return type;
    }
    if (Array.isArray(type) && type.length > 0) {
        // For array types, the first item should be the type string
        var itemType = this.getSchemaType(type[0]);
        if (typeof itemType === 'function') {
            return [itemType];
        }
        else return itemType; // Not resolved, return the type string
    }
    if (typeof type === 'string') {
        var schemaType = ModelBuilder.schemaTypes[type.toLowerCase()];
        if (schemaType) {
            return schemaType;
        } else {
            return type;
        }
    } else if (type.constructor.name == 'Object') {
        // We also support the syntax {type: 'string', ...}
        if (type.type) {
            return this.getSchemaType(type.type);
        } else {
            if(!this.anonymousTypesCount) {
                this.anonymousTypesCount = 0;
            }
            this.anonymousTypesCount++;
            return this.define('AnonymousType' + this.anonymousTypesCount, type, {idInjection: false});
            /*
            console.error(type);
            throw new Error('Missing type property');
            */
        }
    } else if('function' === typeof type ) {
        return type;
    }
    return type;
};

/**
 * Build a dataSource
 * @param {String} name The name of the dataSource
 * @param {Object} properties The properties of the dataSource
 * @param {Object[]} associations An array of associations between models
 * @returns {*}
 */
ModelBuilder.prototype.buildSchema = function(name, properties, associations) {
    for (var p in properties) {
        // console.log(name + "." + p + ": " + properties[p]);
        var type = this.getSchemaType(properties[p]);
        if (typeof type === 'string') {
            // console.log('Association: ' + type);
            if (Array.isArray(associations)) {
                associations.push({
                    source: name,
                    target: type,
                    relation: Array.isArray(properties[p]) ? 'hasMany' : 'belongsTo',
                    as: p
                });
                delete properties[p];
            }
        } else {
            var typeDef = {
                type: type
            };
            for (var a in properties[p]) {
                // Skip the type property but don't delete it Model.extend() shares same instances of the properties from the base class
                if(a !== 'type') {
                    typeDef[a] = properties[p][a];
                }
            }
            properties[p] = typeDef;
        }
    }
    return properties;
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

    if (Array.isArray(schemas)) {
        // An array already
    } else if (schemas.properties && schemas.name) {
        // Only one item
        schemas = [schemas];
    } else {
        // Anonymous dataSource
        schemas = [
            {
                name: 'Anonymous',
                properties: schemas
            }
        ];
    }

    var associations = [];
    for (var s in schemas) {
        var name = schemas[s].name;
        var dataSource = this.buildSchema(name, schemas[s].properties, associations);
        var model = this.define(name, dataSource, schemas[s].options);
        models[name] = model;
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



