/**
 * Module exports class Model
 */
module.exports = ModelBaseClass;

/**
 * Module dependencies
 */
 
var util = require('util');
var traverse = require('traverse');
var jutil = require('./jutil');
var List = require('./list');
var Hookable = require('./hooks');
var validations = require('./validations.js');

var BASE_TYPES = ['String', 'Boolean', 'Number', 'Date', 'Text'];

/**
 * Model class - base class for all persist objects
 * provides **common API** to access any database connector.
 * This class describes only abstract behavior layer, refer to `lib/connectors/*.js`
 * to learn more about specific connector implementations
 *
 * `ModelBaseClass` mixes `Validatable` and `Hookable` classes methods
 *
 * @constructor
 * @param {Object} data - initial object data
 */
function ModelBaseClass(data) {
    this._initProperties(data, true);
}

// FIXME: [rfeng] We need to make sure the input data should not be mutated. Disabled cloning for now to get tests passing
function clone(data) {
    /*
    if(!(data instanceof ModelBaseClass)) {
        if(data && (Array.isArray(data) || 'object' === typeof data)) {
            return traverse(data).clone();
        }
    }
    */
    return data;
}
/**
 * Initialize properties
 * @param data
 * @param applySetters
 * @private
 */
ModelBaseClass.prototype._initProperties = function (data, applySetters) {
    var self = this;
    var ctor = this.constructor;
    
    var properties = ctor.properties;
    data = data || {};

    Object.defineProperty(this, '__cachedRelations', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    Object.defineProperty(this, '__data', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    Object.defineProperty(this, '__dataWas', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    if (data['__cachedRelations']) {
        this.__cachedRelations = data['__cachedRelations'];
    }

    // Check if the strict option is set to false for the model
    var strict = ctor.settings.strict;

    for (var i in data) {
        if (i in properties) {
            this.__data[i] = this.__dataWas[i] = clone(data[i]);
        } else if (i in ctor.relations) {
            this.__data[ctor.relations[i].keyFrom] = this.__dataWas[i] = data[i][ctor.relations[i].keyTo];
            this.__cachedRelations[i] = data[i];
        } else {
            if(strict === false) {
                this.__data[i] = this.__dataWas[i] = clone(data[i]);
            } else if(strict === 'throw') {
                throw new Error('Unknown property: ' + i);
            }
        }
    }

    if (applySetters === true) {
        Object.keys(data).forEach(function (attr) {
            if((attr in properties) || (attr in ctor.relations) || strict === false) {
                self[attr] = self.__data[attr] || data[attr];
            }
        });
    }

    ctor.forEachProperty(function (attr) {

        if ('undefined' === typeof self.__data[attr]) {
            self.__data[attr] = self.__dataWas[attr] = getDefault(attr);
        } else {
            self.__dataWas[attr] = self.__data[attr];
        }

    });

    ctor.forEachProperty(function (attr) {

        var type = properties[attr].type;
        
        if (BASE_TYPES.indexOf(type.name) === -1) {
            if (typeof self.__data[attr] !== 'object' && self.__data[attr]) {
                try {
                    self.__data[attr] = JSON.parse(self.__data[attr] + '');
                } catch (e) {
                    self.__data[attr] = String(self.__data[attr]);
                }
            }
            if (type.name === 'Array' || Array.isArray(type)) {
                if(!(self.__data[attr] instanceof List)) {
                    self.__data[attr] = new List(self.__data[attr], type, self);
                }
            }
        }

    });

    function getDefault(attr) {
        var def = properties[attr]['default'];
        if (isdef(def)) {
            if (typeof def === 'function') {
                return def();
            } else {
                return def;
            }
        } else {
            return undefined;
        }
    }

    this.trigger('initialize');
}

/**
 * @param {String} prop - property name
 * @param {Object} params - various property configuration
 */
ModelBaseClass.defineProperty = function (prop, params) {
    this.dataSource.defineProperty(this.modelName, prop, params);
};

ModelBaseClass.whatTypeName = function (propName) {
    var prop = this.properties[propName];
    if(!prop) {
        // The property is not part of the definition
        return null;
    }
    if (!prop.type) {
        throw new Error('Type not defined for property ' + this.modelName + '.' + propName);
        // return null;
    }
    return prop.type.name;
};

ModelBaseClass.prototype.whatTypeName = function (propName) {
    return this.constructor.whatTypeName(propName);
};

/**
 * Return string representation of class
 *
 * @override default toString method
 */
ModelBaseClass.toString = function () {
    return '[Model ' + this.modelName + ']';
};

/**
 * Convert instance to Object
 *
 * @param {Boolean} onlySchema - restrict properties to dataSource only, default false
 * when onlySchema == true, only properties defined in dataSource returned,
 * otherwise all enumerable properties returned
 * @returns {Object} - canonical object representation (no getters and setters)
 */
ModelBaseClass.prototype.toObject = function (onlySchema) {
    var data = {};
    var self = this;

    var schemaLess = this.constructor.settings.strict === false || !onlySchema;
    this.constructor.forEachProperty(function (attr) {
        if (self[attr] instanceof List) {
            data[attr] = self[attr].toObject(!schemaLess);
        } else if (self.__data.hasOwnProperty(attr)) {
            if(self[attr] !== undefined && self[attr]!== null && self[attr].toObject) {
                data[attr] = self[attr].toObject(!schemaLess);
            } else {
                data[attr] = self[attr];
            }
        } else {
            data[attr] = null;
        }
    });

    if (schemaLess) {
        Object.keys(self.__data).forEach(function (attr) {
            if (!data.hasOwnProperty(attr)) {
                var val = self.__data[attr];
                if(val !== undefined && val!== null && val.toObject) {
                    data[attr] = val.toObject(!schemaLess);
                } else {
                    data[attr] = val;
                }
            }
        });
    }
    return data;
};

// ModelBaseClass.prototype.hasOwnProperty = function (prop) {
//     return this.__data && this.__data.hasOwnProperty(prop) ||
//         Object.getOwnPropertyNames(this).indexOf(prop) !== -1;
// };

ModelBaseClass.prototype.toJSON = function () {
    return this.toObject();
};

ModelBaseClass.prototype.fromObject = function (obj) {
    Object.keys(obj).forEach(function (key) {
        this[key] = obj[key];
    }.bind(this));
};

/**
 * Checks is property changed based on current property and initial value
 *
 * @param {String} attr - property name
 * @return Boolean
 */
ModelBaseClass.prototype.propertyChanged = function propertyChanged(attr) {
    return this.__data[attr] !== this.__dataWas[attr];
};

/**
 * Reset dirty attributes
 *
 * this method does not perform any database operation it just reset object to it's
 * initial state
 */
ModelBaseClass.prototype.reset = function () {
    var obj = this;
    Object.keys(obj).forEach(function (k) {
        if (k !== 'id' && !obj.constructor.dataSource.definitions[obj.constructor.modelName].properties[k]) {
            delete obj[k];
        }
        if (obj.propertyChanged(k)) {
            obj[k] = obj[k + '_was'];
        }
    });
};

ModelBaseClass.prototype.inspect = function () {
    return util.inspect(this.__data, false, 4, true);
};

/**
 * Check whether `s` is not undefined
 * @param {Mixed} s
 * @return {Boolean} s is undefined
 */
function isdef(s) {
    var undef;
    return s !== undef;
}

ModelBaseClass.mixin = function(anotherClass, options) {
    return jutil.mixin(this, anotherClass, options);
}

jutil.mixin(ModelBaseClass, Hookable);
jutil.mixin(ModelBaseClass, validations.Validatable);