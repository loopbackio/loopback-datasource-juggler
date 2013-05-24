/**
 * Module dependencies
 */
var ModelBaseClass = require('./model.js');
// var DataAccessObject = require('./dao.js');
var List = require('./list.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var path = require('path');
var fs = require('fs');

var existsSync = fs.existsSync || path.existsSync;

/**
 * Export public API
 */
exports.Schema = Schema;

// exports.ModelBaseClass = ModelBaseClass;

/**
 * Helpers
 */
var slice = Array.prototype.slice;

Schema.Text = function Text() {};
Schema.JSON = function JSON() {};
Schema.Any = function Any() {};

Schema.types = {};
Schema.registerType = function (type) {
    this.types[type.name] = type;
};

Schema.registerType(Schema.Text);
Schema.registerType(Schema.JSON);
Schema.registerType(Schema.Any);

Schema.registerType(String);
Schema.registerType(Number);
Schema.registerType(Boolean);
Schema.registerType(Date);
Schema.registerType(Buffer);
Schema.registerType(Array);


/**
 * Schema - Data Model Definition
 */
function Schema() {
    // create blank models pool
    this.models = {};
    this.definitions = {};
};

util.inherits(Schema, EventEmitter);


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
Schema.prototype.define = function defineClass(className, properties, settings) {
    var schema = this;
    var args = slice.call(arguments);

    if (!className) throw new Error('Class name required');
    if (args.length == 1) properties = {}, args.push(properties);
    if (args.length == 2) settings   = {}, args.push(settings);

    properties = properties || {};
    settings = settings || {};

    // every class can receive hash of data as optional param
    var ModelClass = function ModelConstructor(data, schema) {
        if (!(this instanceof ModelConstructor)) {
            return new ModelConstructor(data);
        }
        ModelBaseClass.call(this, data);
        hiddenProperty(this, 'schema', schema || this.constructor.schema);
    };

    hiddenProperty(ModelClass, 'schema', schema);
    hiddenProperty(ModelClass, 'modelName', className);
    hiddenProperty(ModelClass, 'relations', {});

    // inherit ModelBaseClass methods
    for (var i in ModelBaseClass) {
        ModelClass[i] = ModelBaseClass[i];
    }
    for (var j in ModelBaseClass.prototype) {
        ModelClass.prototype[j] = ModelBaseClass.prototype[j];
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

    ModelClass.registerProperty = function (attr) {
        var DataType = properties[attr].type;
        if(!DataType) {
            console.error('Not found: ' + attr);
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
        } else if (DataType.name === 'Text' || DataType === Schema.Text) {
            DataType = function Text(s) {
                return s;
            };
        }

        Object.defineProperty(ModelClass.prototype, attr, {
            get: function () {
                if (ModelClass.getter[attr]) {
                    return ModelClass.getter[attr].call(this);
                } else {
                    return this.__data[attr];
                }
            },
            set: function (value) {
                if (ModelClass.setter[attr]) {
                    ModelClass.setter[attr].call(this, value);
                } else {
                    if (value === null || value === undefined) {
                        this.__data[attr] = value;
                    } else {
                        this.__data[attr] = DataType(value);
                    }
                }
            },
            configurable: true,
            enumerable: true
        });

        ModelClass.prototype.__defineGetter__(attr + '_was', function () {
            return this.__dataWas[attr];
        });

        Object.defineProperty(ModelClass.prototype, '_' + attr, {
            get: function () {
                return this.__data[attr];
            },
            set: function (value) {
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
Schema.prototype.defineProperty = function (model, prop, params) {
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
Schema.prototype.extendModel = function (model, props) {
    var t = this;
    standartize(props, {});
    Object.keys(props).forEach(function (propName) {
        var definition = props[propName];
        t.defineProperty(model, propName, definition);
    });
};



Schema.prototype.copyModel = function copyModel(Master) {
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
        writable: false,
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

exports.ADL = new Schema();