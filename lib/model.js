/*!
 * Module exports class Model
 */
module.exports = ModelBaseClass;

/*!
 * Module dependencies
 */

var util = require('util');
var traverse = require('traverse');
var jutil = require('./jutil');
var List = require('./list');
var Hookable = require('./hooks');
var validations = require('./validations.js');

var BASE_TYPES = ['String', 'Boolean', 'Number', 'Date', 'Text', 'ObjectID'];

/**
 * Model class: base class for all persistent objects.
 *
 * `ModelBaseClass` mixes `Validatable` and `Hookable` classes methods
 *
 * @class
 * @param {Object} data Initial object data
 */
function ModelBaseClass(data, options) {
  options = options || {};
  if(!('applySetters' in options)) {
    // Default to true
    options.applySetters = true;
  }
  this._initProperties(data, options);
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
 * Initialize the model instance with a list of properties
 * @param {Object} data The data object
 * @param {Object} options An object to control the instantiation
 * @property {Boolean} applySetters Controls if the setters will be applied
 * @property {Boolean} strict Set the instance level strict mode
 * @private
 */
ModelBaseClass.prototype._initProperties = function (data, options) {
  var self = this;
  var ctor = this.constructor;

  if(data instanceof ctor) {
    // Convert the data to be plain object to avoid polutions
    data = data.toObject(false);
  }
  var properties = ctor.definition.build();
  data = data || {};

  options = options || {};
  var applySetters = options.applySetters;
  var strict = options.strict;

  if(strict === undefined) {
    strict = ctor.definition.settings.strict;
  }
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

  /**
   * Instance level data source
   */
  Object.defineProperty(this, '__dataSource', {
    writable: true,
    enumerable: false,
    configurable: true,
    value: options.dataSource
  });

  /**
   * Instance level strict mode
   */
  Object.defineProperty(this, '__strict', {
    writable: true,
    enumerable: false,
    configurable: true,
    value: strict
  });

  if (data.__cachedRelations) {
    this.__cachedRelations = data.__cachedRelations;
  }

  for (var i in data) {
    if (i in properties && typeof data[i] !== 'function') {
      this.__data[i] = this.__dataWas[i] = clone(data[i]);
    } else if (i in ctor.relations) {
      if (ctor.relations[i].type === 'belongsTo' && data[i] !== null && data[i] !== undefined) {
        // If the related model is populated
        this.__data[ctor.relations[i].keyFrom] = this.__dataWas[i] = data[i][ctor.relations[i].keyTo];
      }
      this.__cachedRelations[i] = data[i];
    } else {
      if (strict === false) {
        this.__data[i] = this.__dataWas[i] = clone(data[i]);
      } else if (strict === 'throw') {
        throw new Error('Unknown property: ' + i);
      }
    }
  }

  var propertyName;
  if (applySetters === true) {
    for (propertyName in data) {
      if (typeof data[propertyName] !== 'function' && ((propertyName in properties) || (propertyName in ctor.relations))) {
        self[propertyName] = self.__data[propertyName] || data[propertyName];
      }
    }
  }

  // Set the unknown properties as properties to the object
  if (strict === false) {
    for (propertyName in data) {
      if (typeof data[propertyName] !== 'function' && !(propertyName in properties)) {
        self[propertyName] = self.__data[propertyName] || data[propertyName];
      }
    }
  }

  ctor.forEachProperty(function (propertyName) {

    if (undefined === self.__data[propertyName]) {
      self.__data[propertyName] = self.__dataWas[propertyName] = getDefault(propertyName);
    } else {
      self.__dataWas[propertyName] = self.__data[propertyName];
    }

  });

  ctor.forEachProperty(function (propertyName) {

    var type = properties[propertyName].type;

    if (BASE_TYPES.indexOf(type.name) === -1) {
      if (typeof self.__data[propertyName] !== 'object' && self.__data[propertyName]) {
        try {
          self.__data[propertyName] = JSON.parse(self.__data[propertyName] + '');
        } catch (e) {
          self.__data[propertyName] = String(self.__data[propertyName]);
        }
      }
      if (type.name === 'Array' || Array.isArray(type)) {
        if (!(self.__data[propertyName] instanceof List)
          && self.__data[propertyName] !== undefined
          && self.__data[propertyName] !== null ) {
          self.__data[propertyName] = List(self.__data[propertyName], type, self);
        }
      }
    }

  });

  function getDefault(propertyName) {
    var def = properties[propertyName]['default'];
    if (def !== undefined) {
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
};

/**
 * Define a property on the model.
 * @param {String} prop Property name
 * @param {Object} params Various property configuration
 */
ModelBaseClass.defineProperty = function (prop, params) {
  this.dataSource.defineProperty(this.modelName, prop, params);
};

ModelBaseClass.getPropertyType = function (propName) {
  var prop = this.definition.properties[propName];
  if (!prop) {
    // The property is not part of the definition
    return null;
  }
  if (!prop.type) {
    throw new Error('Type not defined for property ' + this.modelName + '.' + propName);
    // return null;
  }
  return prop.type.name;
};

ModelBaseClass.prototype.getPropertyType = function (propName) {
  return this.constructor.getPropertyType(propName);
};

/**
 * Return string representation of class
 * This overrides the default `toString()` method
 */
ModelBaseClass.toString = function () {
  return '[Model ' + this.modelName + ']';
};

/**
 * Convert model instance to a plain JSON object.
 * Returns a canonical object representation (no getters and setters).
 *
 * @param {Boolean} onlySchema Restrict properties to dataSource only.  Default is false.  If true, the function returns only properties defined in the schema;  Otherwise it returns all enumerable properties.
 */
ModelBaseClass.prototype.toObject = function (onlySchema, removeHidden) {
  if(onlySchema === undefined) {
    onlySchema = true;
  }
  var data = {};
  var self = this;
  var Model = this.constructor;

  // if it is already an Object
  if(Model === Object) return self;

  var strict = this.__strict;
  var schemaLess = (strict === false) || !onlySchema;

  this.constructor.forEachProperty(function (propertyName) {
    if (removeHidden && Model.isHiddenProperty(propertyName)) {
      return;
    }
    if (typeof self[propertyName] === 'function') {
      return;
    }
    
    if (self[propertyName] instanceof List) {
      data[propertyName] = self[propertyName].toObject(!schemaLess, removeHidden);
    } else if (self.__data.hasOwnProperty(propertyName)) {
      if (self[propertyName] !== undefined && self[propertyName] !== null && self[propertyName].toObject) {
        data[propertyName] = self[propertyName].toObject(!schemaLess, removeHidden);
      } else {
        data[propertyName] = self[propertyName];
      }
    } else {
      data[propertyName] = null;
    }
  });

  var val = null;
  if (schemaLess) {
    // Find its own properties which can be set via myModel.myProperty = 'myValue'.
    // If the property is not declared in the model definition, no setter will be
    // triggered to add it to __data
    for (var propertyName in self) {
      if(removeHidden && Model.isHiddenProperty(propertyName)) {
        continue;
      }
      if(self.hasOwnProperty(propertyName) && (!data.hasOwnProperty(propertyName))) {
        val = self[propertyName];
        if (typeof val === 'function') {
          continue;
        }
        if (val !== undefined && val !== null && val.toObject) {
          data[propertyName] = val.toObject(!schemaLess, removeHidden);
        } else {
          data[propertyName] = val;
        }
      }
    }
    // Now continue to check __data
    for (propertyName in self.__data) {
      if (!data.hasOwnProperty(propertyName)) {
        if(removeHidden && Model.isHiddenProperty(propertyName)) {
          continue;
        }
        val = self.hasOwnProperty(propertyName) ? self[propertyName] : self.__data[propertyName];
        if (typeof val === 'function') {
          continue;
        }
        if (val !== undefined && val !== null && val.toObject) {
          data[propertyName] = val.toObject(!schemaLess, removeHidden);
        } else {
          data[propertyName] = val;
        }
      }
    }
  }

  return data;
};

ModelBaseClass.isHiddenProperty = function(propertyName) {
  var Model = this;
  var settings = Model.definition && Model.definition.settings;
  var hiddenProperties = settings && settings.hidden;
  if(hiddenProperties) {
    return ~hiddenProperties.indexOf(propertyName);  
  } else {
    return false;
  }
}

ModelBaseClass.prototype.toJSON = function () {
  return this.toObject(false, true);
};

ModelBaseClass.prototype.fromObject = function (obj) {
  for (var key in obj) {
    this[key] = obj[key];
  }
};

/**
 * Checks is property changed based on current property and initial value
 *
 * @param {String} propertyName Property name
 * @return Boolean
 */
ModelBaseClass.prototype.propertyChanged = function propertyChanged(propertyName) {
  return this.__data[propertyName] !== this.__dataWas[propertyName];
};

/**
 * Reset dirty attributes.
 * This method does not perform any database operations; it just resets the object to its
 * initial state.
 */
ModelBaseClass.prototype.reset = function () {
  var obj = this;
  for (var k in obj) {
    if (k !== 'id' && !obj.constructor.dataSource.definitions[obj.constructor.modelName].properties[k]) {
      delete obj[k];
    }
    if (obj.propertyChanged(k)) {
      obj[k] = obj[k + '$was'];
    }
  }
};

ModelBaseClass.prototype.inspect = function () {
  return util.inspect(this.__data, false, 4, true);
};

ModelBaseClass.mixin = function (anotherClass, options) {
  return jutil.mixin(this, anotherClass, options);
};

ModelBaseClass.prototype.getDataSource = function () {
  return this.__dataSource || this.constructor.dataSource;
};

ModelBaseClass.getDataSource = function () {
  return this.dataSource;
};

ModelBaseClass.prototype.setStrict = function (strict) {
  this.__strict = strict;
};

jutil.mixin(ModelBaseClass, Hookable);
jutil.mixin(ModelBaseClass, validations.Validatable);
