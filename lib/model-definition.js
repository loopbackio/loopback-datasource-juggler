var assert = require('assert');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Model definition
 */
module.exports = ModelDefinition;

/**
 * Constructor for ModelDefinition
 * @param name
 * @param properties
 * @param settings
 * @returns {ModelDefinition}
 * @constructor
 *
 */
function ModelDefinition(name, properties, settings) {
    if (!(this instanceof ModelDefinition)) {
        return new ModelDefinition(name, properties, settings);
    }
    assert(name, 'name is missing');

    if (arguments.length === 1 && typeof name === 'object') {
        this.name = name.name;
        this.properties = name.properties || {};
        this.settings = name.settings || {};
    } else {
        assert(typeof name === 'string', 'name must be a string');
        this.name = name;
        this.properties = properties || {};
        this.settings = settings || {};
    }
}

util.inherits(ModelDefinition, EventEmitter);

/**
 * Convert to a plain JSON Object
 * @returns {Object}
 */
ModelDefinition.prototype.toJSON = function () {
    return this;
};

/**
 *
 * @returns {*}
 */
ModelDefinition.prototype.build = function () {
    if(this.model) {
        return this.model;
    }
    return this;
};

/**
 * Return table name for specified `modelName`
 * @param {String} connectorType The connector type, such as 'oracle' or 'mongodb'
 */
ModelDefinition.prototype.tableName = function (connectorType) {
    var settings = this.settings;
    if(settings[connectorType]) {
        return settings[connectorType].table || this.name;
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
    if(!propertyName) {
        return propertyName;
    }
    var property = this.properties[propertyName];
    if(property && property[connectorType]) {
        return property[connectorType].columnName || propertyName;
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
    if(!propertyName) {
        return propertyName;
    }
    var property = this.properties[propertyName];
    if(property && property[connectorType]) {
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
    var props = this.properties;
    var cols = [];
    for(var p in props) {
        if(props[p][connectorType]) {
            cols.push(props[p][connectorType].columnName || p);
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
    if(this.ids) {
        return this.ids;
    }
    var ids = [];
    var props = this.properties;
    for (var key in props) {
        var id = props[key].id;
        if(!id) {
            continue;
        }
        if(typeof id !== 'number') {
            id = 1;
        }
        ids.push({name: key, id: id});
    }
    ids.sort(function (a, b) {
        return a.key - b.key;
    });
    return ids;
};

/**
 * Find the ID column name
 * @param {String} modelName The model name
 * @returns {String} columnName for ID
 */
ModelDefinition.prototype.idColumnName = function(connectorType) {
    return this.columnName(connectorType, this.idName());
};

/**
 * Find the ID property name
 * @returns {String} property name for ID
 */
ModelDefinition.prototype.idName = function() {
    var id = this.ids[0];
    return id && id.name;
};

/**
 * Find the ID property names sorted by the index
 * @returns {String[]} property names for IDs
 */
ModelDefinition.prototype.idNames = function () {
    var ids = this.ids;
    var names = ids.map(function (id) {
        return id.name;
    });
    return names;
};
