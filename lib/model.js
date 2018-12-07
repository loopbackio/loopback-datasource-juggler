// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// Turning on strict for this file breaks lots of test cases;
// disabling strict for this file
/* eslint-disable strict */

/*!
 * Module exports class Model
 */
module.exports = ModelBaseClass;

/*!
 * Module dependencies
 */

const g = require('strong-globalize')();
const util = require('util');
const jutil = require('./jutil');
const List = require('./list');
const DataAccessUtils = require('./model-utils');
const Observer = require('./observer');
const Hookable = require('./hooks');
const validations = require('./validations');
const _extend = util._extend;
const utils = require('./utils');
const fieldsToArray = utils.fieldsToArray;
const uuid = require('uuid');
const shortid = require('shortid');

// Set up an object for quick lookup
const BASE_TYPES = {
  'String': true,
  'Boolean': true,
  'Number': true,
  'Date': true,
  'Text': true,
  'ObjectID': true,
};

/**
 * Model class: base class for all persistent objects.
 *
 * `ModelBaseClass` mixes `Validatable` and `Hookable` classes methods
 *
 * @class
 * @param {Object} data Initial object data
 * @param {Object} options An object to control the instantiation
 * @returns {ModelBaseClass} an instance of the ModelBaseClass
 */
function ModelBaseClass(data, options) {
  options = options || {};
  if (!('applySetters' in options)) {
    // Default to true
    options.applySetters = true;
  }
  if (!('applyDefaultValues' in options)) {
    options.applyDefaultValues = true;
  }
  this._initProperties(data, options);
}

/**
 * Initialize the model instance with a list of properties
 * @param {Object} data The data object
 * @param {Object} options An object to control the instantiation
 * @property {Boolean} applySetters Controls if the setters will be applied
 * @property {Boolean} applyDefaultValues Default attributes and values will be applied
 * @property {Boolean} strict Set the instance level strict mode
 * @property {Boolean} persisted Whether the instance has been persisted
 * @private
 */
ModelBaseClass.prototype._initProperties = function(data, options) {
  const self = this;
  const ctor = this.constructor;

  if (typeof data !== 'undefined' && data !== null && data.constructor &&
      typeof (data.constructor) !== 'function') {
    throw new Error(g.f('Property name "{{constructor}}" is not allowed in %s data', ctor.modelName));
  }

  if (data instanceof ctor) {
    // Convert the data to be plain object to avoid pollutions
    data = data.toObject(false);
  }
  const properties = _extend({}, ctor.definition.properties);
  data = data || {};

  if (typeof ctor.applyProperties === 'function') {
    ctor.applyProperties(data);
  }

  options = options || {};
  const applySetters = options.applySetters;
  const applyDefaultValues = options.applyDefaultValues;
  let strict = options.strict;

  if (strict === undefined) {
    strict = ctor.definition.settings.strict;
  } else if (strict === 'throw') {
    g.warn('Warning: Model %s, {{strict mode: `throw`}} has been removed, ' +
      'please use {{`strict: true`}} instead, which returns' +
      '{{`Validation Error`}} for unknown properties,', ctor.modelName);
  }

  const persistUndefinedAsNull = ctor.definition.settings.persistUndefinedAsNull;

  if (ctor.hideInternalProperties) {
    // Object.defineProperty() is expensive. We only try to make the internal
    // properties hidden (non-enumerable) if the model class has the
    // `hideInternalProperties` set to true
    Object.defineProperties(this, {
      __cachedRelations: {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {},
      },

      __data: {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {},
      },

      // Instance level data source
      __dataSource: {
        writable: true,
        enumerable: false,
        configurable: true,
        value: options.dataSource,
      },

      // Instance level strict mode
      __strict: {
        writable: true,
        enumerable: false,
        configurable: true,
        value: strict,
      },

      __persisted: {
        writable: true,
        enumerable: false,
        configurable: true,
        value: false,
      },
    });

    if (strict) {
      Object.defineProperty(this, '__unknownProperties', {
        writable: true,
        enumerable: false,
        configrable: true,
        value: [],
      });
    }
  } else {
    this.__cachedRelations = {};
    this.__data = {};
    this.__dataSource = options.dataSource;
    this.__strict = strict;
    this.__persisted = false;
    if (strict) {
      this.__unknownProperties = [];
    }
  }

  if (options.persisted !== undefined) {
    this.__persisted = options.persisted === true;
  }

  if (data.__cachedRelations) {
    this.__cachedRelations = data.__cachedRelations;
  }

  let keys = Object.keys(data);

  if (Array.isArray(options.fields)) {
    keys = keys.filter(function(k) {
      return (options.fields.indexOf(k) != -1);
    });
  }

  let size = keys.length;
  let p, propVal;
  for (let k = 0; k < size; k++) {
    p = keys[k];
    propVal = data[p];
    if (typeof propVal === 'function') {
      continue;
    }

    if (propVal === undefined && persistUndefinedAsNull) {
      propVal = null;
    }

    if (properties[p]) {
      // Managed property
      if (applySetters || properties[p].id) {
        self[p] = propVal;
      } else {
        self.__data[p] = propVal;
      }
    } else if (ctor.relations[p]) {
      const relationType = ctor.relations[p].type;

      let modelTo;
      if (!properties[p]) {
        modelTo = ctor.relations[p].modelTo || ModelBaseClass;
        const multiple = ctor.relations[p].multiple;
        const typeName = multiple ? 'Array' : modelTo.modelName;
        const propType = multiple ? [modelTo] : modelTo;
        properties[p] = {name: typeName, type: propType};
        /* Issue #1252
        this.setStrict(false);
        */
      }

      // Relation
      if (relationType === 'belongsTo' && propVal != null) {
        // If the related model is populated
        self.__data[ctor.relations[p].keyFrom] = propVal[ctor.relations[p].keyTo];

        if (ctor.relations[p].options.embedsProperties) {
          const fields = fieldsToArray(ctor.relations[p].properties,
            modelTo.definition.properties, modelTo.settings.strict);
          if (!~fields.indexOf(ctor.relations[p].keyTo)) {
            fields.push(ctor.relations[p].keyTo);
          }
          self.__data[p] = new modelTo(propVal, {
            fields: fields,
            applySetters: false,
            persisted: options.persisted,
          });
        }
      }

      self.__cachedRelations[p] = propVal;
    } else {
      // Un-managed property
      if (strict === false || self.__cachedRelations[p]) {
        self[p] = self.__data[p] =
          (propVal !== undefined) ? propVal : self.__cachedRelations[p];

        // Throw error for properties with unsupported names
        if (/\./.test(p)) {
          throw new Error(g.f(
            'Property names containing dot(s) are not supported. ' +
            'Model: %s, dynamic property: %s',
            this.constructor.modelName, p
          ));
        }
      } else {
        if (strict !== 'filter') {
          this.__unknownProperties.push(p);
        }
      }
    }
  }

  keys = Object.keys(properties);

  if (Array.isArray(options.fields)) {
    keys = keys.filter(function(k) {
      return (options.fields.indexOf(k) != -1);
    });
  }

  size = keys.length;

  for (let k = 0; k < size; k++) {
    p = keys[k];
    propVal = self.__data[p];
    const type = properties[p].type;

    // Set default values
    if (applyDefaultValues && propVal === undefined) {
      let def = properties[p]['default'];
      if (def !== undefined) {
        if (typeof def === 'function') {
          if (def === Date) {
            // FIXME: We should coerce the value in general
            // This is a work around to {default: Date}
            // Date() will return a string instead of Date
            def = new Date();
          } else {
            def = def();
          }
        } else if (type.name === 'Date' && def === '$now') {
          def = new Date();
        }
        // FIXME: We should coerce the value
        // will implement it after we refactor the PropertyDefinition
        self.__data[p] = propVal = def;
      }
    }

    // Set default value using a named function
    if (applyDefaultValues && propVal === undefined) {
      const defn = properties[p].defaultFn;
      switch (defn) {
        case undefined:
          break;
        case 'guid':
        case 'uuid':
          // Generate a v1 (time-based) id
          propVal = uuid.v1();
          break;
        case 'uuidv4':
          // Generate a RFC4122 v4 UUID
          propVal = uuid.v4();
          break;
        case 'now':
          propVal = new Date();
          break;
        case 'shortid':
          propVal = shortid.generate();
          break;
        default:
          // TODO Support user-provided functions via a registry of functions
          g.warn('Unknown default value provider %s', defn);
      }
      // FIXME: We should coerce the value
      // will implement it after we refactor the PropertyDefinition
      if (propVal !== undefined)
        self.__data[p] = propVal;
    }

    if (propVal === undefined && persistUndefinedAsNull) {
      self.__data[p] = propVal = null;
    }

    // Handle complex types (JSON/Object)
    if (!BASE_TYPES[type.name]) {
      if (typeof self.__data[p] !== 'object' && self.__data[p]) {
        try {
          self.__data[p] = JSON.parse(self.__data[p] + '');
        } catch (e) {
          self.__data[p] = String(self.__data[p]);
        }
      }

      if (type.prototype instanceof ModelBaseClass) {
        if (!(self.__data[p] instanceof type) &&
            typeof self.__data[p] === 'object' &&
            self.__data[p] !== null) {
          self.__data[p] = new type(self.__data[p]);
        }
      } else if (type.name === 'Array' || Array.isArray(type)) {
        if (!(self.__data[p] instanceof List) &&
            self.__data[p] !== undefined &&
            self.__data[p] !== null) {
          self.__data[p] = List(self.__data[p], type, self);
        }
      }
    }
  }
  this.trigger('initialize');
};

/**
 * Define a property on the model.
 * @param {String} prop Property name
 * @param {Object} params Various property configuration
 */
ModelBaseClass.defineProperty = function(prop, params) {
  if (this.dataSource) {
    this.dataSource.defineProperty(this.modelName, prop, params);
  } else {
    this.modelBuilder.defineProperty(this.modelName, prop, params);
  }
};

/**
 * Get model property type.
 * @param {String} propName Property name
 * @returns {String} Name of property type
 */
ModelBaseClass.getPropertyType = function(propName) {
  const prop = this.definition.properties[propName];
  if (!prop) {
    // The property is not part of the definition
    return null;
  }
  if (!prop.type) {
    throw new Error(g.f('Type not defined for property %s.%s', this.modelName, propName));
    // return null;
  }
  return prop.type.name;
};

/**
 * Get model property type.
 * @param {String} propName Property name
 * @returns {String} Name of property type
 */
ModelBaseClass.prototype.getPropertyType = function(propName) {
  return this.constructor.getPropertyType(propName);
};

/**
 * Return string representation of class
 * This overrides the default `toString()` method
 */
ModelBaseClass.toString = function() {
  return '[Model ' + this.modelName + ']';
};

/**
 * Convert model instance to a plain JSON object.
 * Returns a canonical object representation (no getters and setters).
 *
 * @param {Boolean} onlySchema Restrict properties to dataSource only.  Default is false.  If true, the function returns only properties defined in the schema;  Otherwise it returns all enumerable properties.
 * @param {Boolean} removeHidden Boolean flag as part of the transformation. If true, then hidden properties should not be brought out.
 * @param {Boolean} removeProtected Boolean flag as part of the transformation. If true, then protected properties should not be brought out.
 * @returns {Object} returns Plain JSON object
 */
ModelBaseClass.prototype.toObject = function(onlySchema, removeHidden, removeProtected) {
  if (typeof onlySchema === 'object' && onlySchema != null) {
    const options = onlySchema;
    onlySchema = options.onlySchema;
    removeHidden = options.removeHidden;
    removeProtected = options.removeProtected;
  }
  if (onlySchema === undefined) {
    onlySchema = true;
  }
  const data = {};
  const self = this;
  const Model = this.constructor;

  // if it is already an Object
  if (Model === Object) {
    return self;
  }

  const strict = this.__strict;
  const schemaLess = (strict === false) || !onlySchema;
  const persistUndefinedAsNull = Model.definition.settings.persistUndefinedAsNull;

  const props = Model.definition.properties;
  let keys = Object.keys(props);
  let propertyName, val;

  for (let i = 0; i < keys.length; i++) {
    propertyName = keys[i];
    val = self[propertyName];

    // Exclude functions
    if (typeof val === 'function') {
      continue;
    }
    // Exclude hidden properties
    if (removeHidden && Model.isHiddenProperty(propertyName)) {
      continue;
    }

    if (removeProtected && Model.isProtectedProperty(propertyName)) {
      continue;
    }

    if (val instanceof List) {
      data[propertyName] = val.toObject(!schemaLess, removeHidden, true);
    } else {
      if (val !== undefined && val !== null && val.toObject) {
        data[propertyName] = val.toObject(!schemaLess, removeHidden, true);
      } else {
        if (val === undefined && persistUndefinedAsNull) {
          val = null;
        }
        data[propertyName] = val;
      }
    }
  }

  if (schemaLess) {
    // Find its own properties which can be set via myModel.myProperty = 'myValue'.
    // If the property is not declared in the model definition, no setter will be
    // triggered to add it to __data
    keys = Object.keys(self);
    let size = keys.length;
    for (let i = 0; i < size; i++) {
      propertyName = keys[i];
      if (props[propertyName]) {
        continue;
      }
      if (propertyName.indexOf('__') === 0) {
        continue;
      }
      if (removeHidden && Model.isHiddenProperty(propertyName)) {
        continue;
      }
      if (removeProtected && Model.isProtectedProperty(propertyName)) {
        continue;
      }
      if (data[propertyName] !== undefined) {
        continue;
      }
      val = self[propertyName];
      if (val !== undefined) {
        if (typeof val === 'function') {
          continue;
        }
        if (val !== null && val.toObject) {
          data[propertyName] = val.toObject(!schemaLess, removeHidden, true);
        } else {
          data[propertyName] = val;
        }
      } else if (persistUndefinedAsNull) {
        data[propertyName] = null;
      }
    }
    // Now continue to check __data
    keys = Object.keys(self.__data);
    size = keys.length;
    for (let i = 0; i < size; i++) {
      propertyName = keys[i];
      if (propertyName.indexOf('__') === 0) {
        continue;
      }
      if (data[propertyName] === undefined) {
        if (removeHidden && Model.isHiddenProperty(propertyName)) {
          continue;
        }
        if (removeProtected && Model.isProtectedProperty(propertyName)) {
          continue;
        }
        const ownVal = self[propertyName];
        // The ownVal can be a relation function
        val = (ownVal !== undefined && (typeof ownVal !== 'function')) ? ownVal : self.__data[propertyName];
        if (typeof val === 'function') {
          continue;
        }

        if (val !== undefined && val !== null && val.toObject) {
          data[propertyName] = val.toObject(!schemaLess, removeHidden, true);
        } else if (val === undefined && persistUndefinedAsNull) {
          data[propertyName] = null;
        } else {
          data[propertyName] = val;
        }
      }
    }
  }

  return data;
};

/**
 * Convert an array of strings into an object as the map
 * @param {string[]} arr An array of strings
 */
function asObjectMap(arr) {
  const obj = {};
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      obj[arr[i]] = true;
    }
    return obj;
  }
  return arr || obj;
}
/**
 * Checks if property is protected.
 * @param {String} propertyName Property name
 * @returns  {Boolean} true or false if protected or not.
 */
ModelBaseClass.isProtectedProperty = function(propertyName) {
  const settings = (this.definition && this.definition.settings) || {};
  const protectedProperties = settings.protectedProperties || settings.protected;
  settings.protectedProperties = asObjectMap(protectedProperties);
  return settings.protectedProperties[propertyName];
};

/**
 * Checks if property is hidden.
 * @param {String} propertyName Property name
 * @returns {Boolean} true or false if hidden or not.
 */
ModelBaseClass.isHiddenProperty = function(propertyName) {
  const settings = (this.definition && this.definition.settings) || {};
  const hiddenProperties = settings.hiddenProperties || settings.hidden;
  settings.hiddenProperties = asObjectMap(hiddenProperties);
  return settings.hiddenProperties[propertyName];
};

ModelBaseClass.prototype.toJSON = function() {
  return this.toObject(false, true, false);
};

ModelBaseClass.prototype.fromObject = function(obj) {
  for (const key in obj) {
    this[key] = obj[key];
  }
};

/**
 * Reset dirty attributes.
 * This method does not perform any database operations; it just resets the object to its
 * initial state.
 */
ModelBaseClass.prototype.reset = function() {
  const obj = this;
  for (const k in obj) {
    if (k !== 'id' && !obj.constructor.dataSource.definitions[obj.constructor.modelName].properties[k]) {
      delete obj[k];
    }
  }
};

// Node v0.11+ allows custom inspect functions to return an object
// instead of string. That way options like `showHidden` and `colors`
// can be preserved.
const versionParts = process.versions && process.versions.node ?
  process.versions.node.split(/\./g).map(function(v) { return +v; }) :
  [1, 0, 0]; // browserify ships 1.0-compatible version of util.inspect

const INSPECT_SUPPORTS_OBJECT_RETVAL =
 versionParts[0] > 0 ||
 versionParts[1] > 11 ||
 (versionParts[0] === 11 && versionParts[1] >= 14);

ModelBaseClass.prototype.inspect = function(depth) {
  if (INSPECT_SUPPORTS_OBJECT_RETVAL)
    return this.__data;

  // Workaround for older versions
  // See also https://github.com/joyent/node/commit/66280de133
  return util.inspect(this.__data, {
    showHidden: false,
    depth: depth,
    colors: false,
  });
};

/**
 *
 * @param {String} anotherClass could be string or class. Name of the class or the class itself
 * @param {Object} options An object to control the instantiation
 * @returns {ModelClass}
 */
ModelBaseClass.mixin = function(anotherClass, options) {
  if (typeof anotherClass === 'string') {
    this.modelBuilder.mixins.applyMixin(this, anotherClass, options);
  } else {
    if (anotherClass.prototype instanceof ModelBaseClass) {
      const props = anotherClass.definition.properties;
      for (const i in props) {
        if (this.definition.properties[i]) {
          continue;
        }
        this.defineProperty(i, props[i]);
      }
    }
    return jutil.mixin(this, anotherClass, options);
  }
};

ModelBaseClass.prototype.getDataSource = function() {
  return this.__dataSource || this.constructor.dataSource;
};

ModelBaseClass.getDataSource = function() {
  return this.dataSource;
};

ModelBaseClass.prototype.setStrict = function(strict) {
  this.__strict = strict;
};

/**
 *
 * `getMergePolicy()` provides model merge policies to apply when extending
 * a child model from a base model. Such a policy drives the way parent/child model
 * properties/settings are merged/mixed-in together.
 *
 * Below is presented the expected merge behaviour for each option.
 * NOTE: This applies to top-level settings properties
 *
 *
 * - Any
 *     - `{replace: true}` (default): child replaces the value from parent
 *     - assignin `null` on child setting deletes the inherited setting
 *
 * - Arrays:
 *     - `{replace: false}`: unique elements of parent and child cumulate
 *     - `{rank: true}` adds the model inheritance rank to array
 *       elements of type Object {} as internal property `__rank`
 *
 * - Object {}:
 *     - `{replace: false}`: deep merges parent and child objects
 *     - `{patch: true}`: child replaces inner properties from parent
 *
 *
 * The recommended built-in merge policy is as follows. It is returned by getMergePolicy()
 * when calling the method with option `{configureModelMerge: true}`.
 *
 * ```
 * {
 *   description: {replace: true}, // string or array
 *   options: {patch: true}, // object
 *   hidden: {replace: false}, // array
 *   protected: {replace: false}, // array
 *   indexes: {patch: true}, // object
 *   methods: {patch: true}, // object
 *   mixins: {patch: true}, // object
 *   relations: {patch: true}, // object
 *   scope: {replace: true}, // object
 *   scopes: {patch: true}, // object
 *   acls: {rank: true}, // array
 *   // this setting controls which child model property's value allows deleting
 *   // a base model's property
 *   __delete: null,
 *   // this setting controls the default merge behaviour for settings not defined
 *   // in the mergePolicy specification
 *   __default: {replace: true},
 * }
 * ```
 *
 * The legacy built-in merge policy is as follows, it is retuned by `getMergePolicy()`
 * when avoiding option `configureModelMerge`.
 * NOTE: it also provides the ACLs ranking in addition to the legacy behaviour, as well
 * as fixes for settings 'description' and 'relations': matching relations from child
 * replace relations from parents.
 *
 * ```
 * {
 *   description: {replace: true}, // string or array
 *   properties: {patch: true}, // object
 *   hidden: {replace: false}, // array
 *   protected: {replace: false}, // array
 *   relations: {acls: true}, // object
 *   acls: {rank: true}, // array
 * }
 * ```
 *
 *
 * `getMergePolicy()` can be customized using model's setting `configureModelMerge` as follows:
 *
 * ``` json
 * {
 * // ..
 * options: {
 *   configureModelMerge: {
 *     // merge options
 *   }
 * }
 * // ..
 * }
 * ```
 *
 * NOTE: mergePolicy parameter can also defined at JSON model definition root
 *
 * `getMergePolicy()` method can also be extended programmatically as follows:
 *
 * ``` js
 * myModel.getMergePolicy = function(options) {
 *   const origin = myModel.base.getMergePolicy(options);
 *   return Object.assign({}, origin, {
 *     // new/overriding options
 *   });
 * };
 * ```
 *
 * @param {Object} options option `configureModelMerge` can be used to alter the
 *  returned merge policy:
 *  - `configureModelMerge: true` will have the method return the recommended merge policy.
 *  - `configureModelMerge: {..}` will actually have the method return the provided object.
 *  - not providing this options will have the method return a merge policy emulating the
 *  the model merge behaviour up to datasource-juggler v3.6.1, as well as the ACLs ranking.
 * @returns {Object} mergePolicy The model merge policy to apply when using the
 *  current model as base class for a child model
 */
ModelBaseClass.getMergePolicy = function(options) {
  // NOTE: merge policy equivalent to datasource-juggler behaviour up to v3.6.1
  // + fix for description arrays that should not be merged
  // + fix for relations that should patch matching relations
  // + ranking of ACLs
  let mergePolicy = {
    description: {replace: true}, // string or array
    properties: {patch: true}, // object
    hidden: {replace: false}, // array
    protected: {replace: false}, // array
    relations: {patch: true}, // object
    acls: {rank: true}, // array
  };

  const config = (options || {}).configureModelMerge;

  if (config === true) {
    // NOTE: recommended merge policy from datasource-juggler v3.6.2
    mergePolicy = {
      description: {replace: true}, // string or array
      options: {patch: true}, // object
      // properties: {patch: true}, // object // NOTE: not part of configurable merge
      hidden: {replace: false}, // array
      protected: {replace: false}, // array
      indexes: {patch: true}, // object
      methods: {patch: true}, // object
      mixins: {patch: true}, // object
      // validations: {patch: true}, // object // NOTE: not implemented
      relations: {patch: true}, // object
      scope: {replace: true}, // object
      scopes: {patch: true}, // object
      acls: {rank: true}, // array
      // this option controls which value assigned on child model allows deleting
      // a base model's setting
      __delete: null,
      // this option controls the default merge behaviour for settings not defined
      // in the mergePolicy specification
      __default: {replace: true},
    };
  }

  // override mergePolicy with provided model setting if required
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    // config is an object
    mergePolicy = config;
  }

  return mergePolicy;
};

/**
 * Gets properties defined with 'updateOnly' flag set to true from the model. This flag is also set to true
 * internally for the id property, if this property is generated and IdInjection is true.
 * @returns {updateOnlyProps} List of properties with updateOnly set to true.
 */

ModelBaseClass.getUpdateOnlyProperties = function() {
  const props = this.definition.properties;
  return Object.keys(props).filter(key => props[key].updateOnly);
};

// Mix in utils
jutil.mixin(ModelBaseClass, DataAccessUtils);

// Mixin observer
jutil.mixin(ModelBaseClass, Observer);

jutil.mixin(ModelBaseClass, Hookable);
jutil.mixin(ModelBaseClass, validations.Validatable);
