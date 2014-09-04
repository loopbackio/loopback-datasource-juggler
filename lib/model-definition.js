var assert = require('assert');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var traverse = require('traverse');
var ModelBaseClass = require('./model');
var ModelBuilder = require('./model-builder');

/**
 * Model definition
 */
module.exports = ModelDefinition;

/**
 * Constructor for ModelDefinition
 * @param {ModelBuilder} modelBuilder A model builder instance
 * @param {String|Object} name The model name or the schema object
 * @param {Object} properties The model properties, optional
 * @param {Object} settings The model settings, optional
 * @returns {ModelDefinition}
 * @constructor
 *
 */
function ModelDefinition(modelBuilder, name, properties, settings) {
  if (!(this instanceof ModelDefinition)) {
    // Allow to call ModelDefinition without new
    return new ModelDefinition(modelBuilder, name, properties, settings);
  }
  this.modelBuilder = modelBuilder || ModelBuilder.defaultInstance;
  assert(name, 'name is missing');

  if (arguments.length === 2 && typeof name === 'object') {
    var schema = name;
    this.name = schema.name;
    this.rawProperties = schema.properties || {}; // Keep the raw property definitions
    this.settings = schema.settings || {};
  } else {
    assert(typeof name === 'string', 'name must be a string');
    this.name = name;
    this.rawProperties = properties || {}; // Keep the raw property definitions
    this.settings = settings || {};
  }
  this.relations = [];
  this.properties = null;
  this.build();
}

util.inherits(ModelDefinition, EventEmitter);

// Set up types
require('./types')(ModelDefinition);

/**
 * Return table name for specified `modelName`
 * @param {String} connectorType The connector type, such as 'oracle' or 'mongodb'
 */
ModelDefinition.prototype.tableName = function (connectorType) {
  var settings = this.settings;
  if (settings[connectorType]) {
    return settings[connectorType].table || settings[connectorType].tableName || this.name;
  } else {
    return this.name;
  }
};

/**
 * Return column name for specified modelName and propertyName
 * @param {String} connectorType The connector type, such as 'oracle' or 'mongodb'
 * @param propertyName The property name
 * @returns {String} columnName
 */
ModelDefinition.prototype.columnName = function (connectorType, propertyName) {
  if (!propertyName) {
    return propertyName;
  }
  this.build();
  var property = this.properties[propertyName];
  if (property && property[connectorType]) {
    return property[connectorType].column || property[connectorType].columnName || propertyName;
  } else {
    return propertyName;
  }
};

/**
 * Return column metadata for specified modelName and propertyName
 * @param {String} connectorType The connector type, such as 'oracle' or 'mongodb'
 * @param propertyName The property name
 * @returns {Object} column metadata
 */
ModelDefinition.prototype.columnMetadata = function (connectorType, propertyName) {
  if (!propertyName) {
    return propertyName;
  }
  this.build();
  var property = this.properties[propertyName];
  if (property && property[connectorType]) {
    return property[connectorType];
  } else {
    return null;
  }
};

/**
 * Return column names for specified modelName
 * @param {String} connectorType The connector type, such as 'oracle' or 'mongodb'
 * @returns {String[]} column names
 */
ModelDefinition.prototype.columnNames = function (connectorType) {
  this.build();
  var props = this.properties;
  var cols = [];
  for (var p in props) {
    if (props[p][connectorType]) {
      cols.push(property[connectorType].column || props[p][connectorType].columnName || p);
    } else {
      cols.push(p);
    }
  }
  return cols;
};

/**
 * Find the ID properties sorted by the index
 * @returns {Object[]} property name/index for IDs
 */
ModelDefinition.prototype.ids = function () {
  if (this._ids) {
    return this._ids;
  }
  var ids = [];
  this.build();
  var props = this.properties;
  for (var key in props) {
    var id = props[key].id;
    if (!id) {
      continue;
    }
    if (typeof id !== 'number') {
      id = 1;
    }
    ids.push({name: key, id: id, property: props[key]});
  }
  ids.sort(function (a, b) {
    return a.key - b.key;
  });
  this._ids = ids;
  return ids;
};

/**
 * Find the ID column name
 * @param {String} modelName The model name
 * @returns {String} columnName for ID
 */
ModelDefinition.prototype.idColumnName = function (connectorType) {
  return this.columnName(connectorType, this.idName());
};

/**
 * Find the ID property name
 * @returns {String} property name for ID
 */
ModelDefinition.prototype.idName = function () {
  var id = this.ids()[0];
  if (this.properties.id && this.properties.id.id) {
    return 'id';
  } else {
    return id && id.name;
  }
};

/**
 * Find the ID property names sorted by the index
 * @returns {String[]} property names for IDs
 */
ModelDefinition.prototype.idNames = function () {
  var ids = this.ids();
  var names = ids.map(function (id) {
    return id.name;
  });
  return names;
};

/**
 *
 * @returns {{}}
 */
ModelDefinition.prototype.indexes = function () {
  this.build();
  var indexes = {};
  if (this.settings.indexes) {
    for (var i in this.settings.indexes) {
      indexes[i] = this.settings.indexes[i];
    }
  }
  for (var p in this.properties) {
    if (this.properties[p].index) {
      indexes[p + '_index'] = this.properties[p].index;
    }
  }
  return indexes;
};

/**
 * Build a model definition
 * @param {Boolean} force Forcing rebuild
 */
ModelDefinition.prototype.build = function (forceRebuild) {
  if (forceRebuild) {
    this.properties = null;
    this.relations = [];
    this._ids = null;
    this.json = null;
  }
  if (this.properties) {
    return this.properties;
  }
  this.properties = {};
  for (var p in this.rawProperties) {
    var prop = this.rawProperties[p];
    var type = this.modelBuilder.resolveType(prop);
    if (typeof type === 'string') {
      this.relations.push({
        source: this.name,
        target: type,
        type: Array.isArray(prop) ? 'hasMany' : 'belongsTo',
        as: p
      });
    } else {
      var typeDef = {
        type: type
      };
      if (typeof prop === 'object' && prop !== null) {
        for (var a in prop) {
          // Skip the type property but don't delete it Model.extend() shares same instances of the properties from the base class
          if (a !== 'type') {
            typeDef[a] = prop[a];
          }
        }
      }
      this.properties[p] = typeDef;
    }
  }
  return this.properties;
};

/**
 * Define a property
 * @param {String} propertyName The property name
 * @param {Object} propertyDefinition The property definition
 */
ModelDefinition.prototype.defineProperty = function (propertyName, propertyDefinition) {
  this.rawProperties[propertyName] = propertyDefinition;
  this.build(true);
};

function isModelClass(cls) {
  if (!cls) {
    return false;
  }
  return cls.prototype instanceof ModelBaseClass;
}

ModelDefinition.prototype.toJSON = function (forceRebuild) {
  if (forceRebuild) {
    this.json = null;
  }
  if (this.json) {
    return this.json;
  }
  var json = {
    name: this.name,
    properties: {},
    settings: this.settings
  };
  this.build(forceRebuild);

  var mapper = function (val) {
    if (val === undefined || val === null) {
      return val;
    }
    if ('function' === typeof val.toJSON) {
      // The value has its own toJSON() object
      return val.toJSON();
    }
    if ('function' === typeof val) {
      if (isModelClass(val)) {
        if (val.settings && val.settings.anonymous) {
          return val.definition && val.definition.toJSON().properties;
        } else {
          return val.modelName;
        }
      }
      return val.name;
    } else {
      return val;
    }
  };
  for (var p in this.properties) {
    json.properties[p] = traverse(this.properties[p]).map(mapper);
  }
  this.json = json;
  return json;
};
