/**
 * Module dependencies
 */

var i8n = require('inflection');
var ModelBaseClass = require('./model.js');
var List = require('./list.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var GeoPoint = require('./geo').GeoPoint;

/**
 * Export public API
 */
exports.Schema = exports.ModelBuilder = ModelBuilder;

// exports.ModelBaseClass = ModelBaseClass;

/**
 * Helpers
 */
var slice = Array.prototype.slice;

/**
 * Schema types
 */
ModelBuilder.Text = function Text() {}; // Text type
ModelBuilder.JSON = function JSON() {}; // JSON Object
ModelBuilder.Any = function Any() {}; // Any Type

ModelBuilder.schemaTypes = {};
ModelBuilder.registerType = function (type, names) {
    names = names || [];
    names = names.concat([type.name]);
    for (var n = 0; n < names.length; n++) {
        this.schemaTypes[names[n].toLowerCase()] = type;
    }
};

ModelBuilder.registerType(ModelBuilder.Text);
ModelBuilder.registerType(ModelBuilder.JSON);
ModelBuilder.registerType(ModelBuilder.Any);

ModelBuilder.registerType(String);
ModelBuilder.registerType(Number);
ModelBuilder.registerType(Boolean);
ModelBuilder.registerType(Date);
ModelBuilder.registerType(Buffer, ['Binary']);
ModelBuilder.registerType(Array);
ModelBuilder.registerType(GeoPoint);
ModelBuilder.registerType(Object);


/**
 * ModelBuilder - Data Model Definition
 */
function ModelBuilder() {
    // create blank models pool
    this.models = {};
    this.definitions = {};
};

util.inherits(ModelBuilder, EventEmitter);


/**
 * Define class
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
 * var User = schema.define('User', {
 *     email: String,
 *     password: String,
 *     birthDate: Date,
 *     activated: Boolean
 * });
 * ```
 * @example more advanced case
 * ```
 * var User = schema.define('User', {
 *     email: { type: String, limit: 150, index: true },
 *     password: { type: String, limit: 50 },
 *     birthDate: Date,
 *     registrationDate: {type: Date, default: function () { return new Date }},
 *     activated: { type: Boolean, default: false }
 * });
 * ```
 */
ModelBuilder.prototype.define = function defineClass(className, properties, settings, parent) {
    var schema = this;
    var args = slice.call(arguments);
    var pluralName = settings && settings.plural;
    var ModelBaseClass = parent || require('./model.js');

    if (!className) throw new Error('Class name required');
    if (args.length == 1) properties = {}, args.push(properties);
    if (args.length == 2) settings   = {}, args.push(settings);

    properties = properties || {};
    settings = settings || {};

    this.buildSchema(className, properties);

    // every class can receive hash of data as optional param
    var ModelClass = function ModelConstructor(data, schema) {
        if(!(this instanceof ModelConstructor)) {
            return new ModelConstructor(data, schema);
        }
        ModelBaseClass.apply(this, arguments);
        if(!this.schema) {
          hiddenProperty(this, 'schema', schema || this.constructor.schema);
        }
    };
    
    // mix in EventEmitter
    var events = new EventEmitter();
    ModelClass.on = events.on.bind(events);
    ModelClass.once = events.once.bind(events);
    ModelClass.emit = events.emit.bind(events);

    hiddenProperty(ModelClass, 'schema', schema);
    hiddenProperty(ModelClass, 'modelName', className);
    hiddenProperty(ModelClass, 'pluralModelName', pluralName || i8n.pluralize(className));
    hiddenProperty(ModelClass, 'relations', {});

    // inherit ModelBaseClass methods
    for (var i in ModelBaseClass) {
        ModelClass[i] = ModelBaseClass[i];
    }
    
    util.inherits(ModelClass, ModelBaseClass);
    
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
        properties.id = properties.id || { type: Number, id: 1 };
        if (!properties.id.id) {
            properties.id.id = 1;
        }
    }

    ModelClass.forEachProperty = function (cb) {
        Object.keys(properties).forEach(cb);
    };

    ModelClass.attachTo = function (dataSource) {
        dataSource.attach(this);
    }
    
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
        
        var c = schema.define(className, p, s, ModelClass); 
        
        if(typeof c.setup === 'function') {
          c.setup.call(c);
        }
        
        return c;
    }

    ModelClass.registerProperty = function (attr) {
        var DataType = properties[attr].type;
        if(!DataType) {
            throw new Error('Invalid type for property ' + attr);
        }
        if (DataType instanceof Array) {
            DataType = List;
        } else if (DataType.name === 'Date') {
            var OrigDate = Date;
            DataType = function Date(arg) {
                return new OrigDate(arg);
            };
        } else if (DataType.name === 'JSON' || DataType === JSON) {
            DataType = function JSON(s) {
                return s;
            };
        } else if (DataType.name === 'Text' || DataType === ModelBuilder.Text) {
            DataType = function Text(s) {
                return s;
            };
        } else if(typeof DataType === 'string') {
            DataType = schema.getSchemaType(DataType);
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

        Object.defineProperty(ModelClass.prototype, '_' + attr, {
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
        if (
            typeof v === 'function' ||
                typeof v === 'object' && v && v.constructor.name === 'Array'
            ) {
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
 * @param {String} prop - name of propery
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
 *     // schema.extend allows to
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
    var schema = this;
    var className = Master.modelName;
    var md = Master.schema.definitions[className];
    var Slave = function SlaveModel() {
        Master.apply(this, [].slice.call(arguments));
        this.schema = schema;
    };

    util.inherits(Slave, Master);

    Slave.__proto__ = Master;

    hiddenProperty(Slave, 'schema', schema);
    hiddenProperty(Slave, 'modelName', className);
    hiddenProperty(Slave, 'relations', Master.relations);

    if (!(className in schema.models)) {

        // store class in model pool
        schema.models[className] = Slave;
        schema.definitions[className] = {
            properties: md.properties,
            settings: md.settings
        };
    }

    return Slave;
};



/**
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
 * @param type The type string, such as 'number', 'Number', 'boolean', or 'String'. It's case insensitive
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
                this.anonymousTypesCount = 1;
            }
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
}

/**
 * Build a schema
 * @param name The name of the schema
 * @param properties The properties of the schema
 * @param associations An array of associations between models
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
            delete properties[p].type;
            for (var a in properties[p]) {
                typeDef[a] = properties[p][a];
            }
            properties[p] = typeDef;
        }
    }
    return properties;
}


/**
 * Build models from schema definitions
 * @param schemas The schemas can be one of the following three formats:
 * 1. An array of named schema definition JSON objects
 * 2. A schema definition JSON object
 * 3. A list of property definitions (anonymous)
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
        // Anonymous schema
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
        var schema = this.buildSchema(name, schemas[s].properties, associations);
        var model = this.define(name, schema, schemas[s].options);
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
}



