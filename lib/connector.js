module.exports = Connector;

/**
 * Base class for LooopBack connector. This is more a collection of useful
 * methods for connectors than a super class
 * @constructor
 */
function Connector(name, settings) {
    this._models = {};
    this.name = name;
    this.settings = settings || {};
}

/**
 * Set the relational property to indicate the backend is a relational DB
 * @type {boolean}
 */
Connector.prototype.relational = false;

/**
 * Execute a command with given parameters
 * @param {String} command The command such as SQL
 * @param {Object[]} [params] An array of parameters
 * @param {Function} [callback] The callback function
 */
Connector.prototype.execute = function (command, params, callback) {
    throw new Error('query method should be declared in connector');
};


/**
 * Look up the data source by model name
 * @param {String} model The model name
 * @returns {DataSource} The data source
 */
Connector.prototype.getDataSource = function(model) {
    var m = this._models[model];
    if(!m) {
        console.trace('Model not found: ' + model);
    }
    return m && m.model.dataSource;
};

/**
 * Get the id property name
 * @param {String} model The model name
 * @returns {String} The id property name
 */
Connector.prototype.idName = function (model) {
    return this.getDataSource(model).idName(model);
};

/**
 * Get the id property names
 * @param {String} model The model name
 * @returns {[String]} The id property names
 */
Connector.prototype.idNames = function (model) {
    return this.getDataSource(model).idNames(model);
};


/**
 * Get the id index (sequence number, starting from 1)
 * @param {String} model The model name
 * @param {String} prop The property name
 * @returns {Number} The id index, undefined if the property is not part of the primary key
 */
Connector.prototype.id = function (model, prop) {
    var p = this._models[model].properties[prop];
    if(!p) {
        console.trace('Property not found: ' + model +'.' + prop);
    }
    return p.id;
};

/**
 * Hook to be called by DataSource for defining a model
 * @param {Object} modelDefinition The model definition
 */
Connector.prototype.define = function (modelDefinition) {
    if (!modelDefinition.settings) {
        modelDefinition.settings = {};
    }
    this._models[modelDefinition.model.modelName] = modelDefinition;
};

/**
 * Hook to be called by DataSource for defining a model property
 * @param {String} model The model name
 * @param {String} propertyName The property name
 * @param {Object} propertyDefinition The object for property metadata
 */
Connector.prototype.defineProperty = function (model, propertyName, propertyDefinition) {
    this._models[model].properties[propertyName] = propertyDefinition;
};

/**
 * Disconnect from the connector
 */
Connector.prototype.disconnect = function disconnect(cb) {
    // NO-OP
};

/**
 * Get the id value for the given model
 * @param {String} model The model name
 * @param {Object} data The model instance data
 * @returns {*} The id value
 *
 */
Connector.prototype.getIdValue = function(model, data) {
    return data && data[this.idName(model)];
};

/**
 * Set the id value for the given model
 * @param {String} model The model name
 * @param {Object} data The model instance data
 * @param {*} value The id value
 *
 */
Connector.prototype.setIdValue = function(model, data, value) {
    if(data) {
        data[this.idName(model)] = value;
    }
};




