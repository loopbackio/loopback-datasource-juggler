# loopback-datasource-juggler-connector

Loopback connectors provide access to backend systems including databases, REST APIs
and other services. Connectors are not used directly by application code. We create
a DataSource to interact with the connector.

For example,

    var DataSource = require('loopback-datasource-juggler').DataSource;
    var oracleConnector = require('loopback-connector-oracle');

    var ds = new DataSource(oracleConnector, {
        host : '166.78.158.45',
        database : 'XE',
        username : 'strongloop',
        password : 'str0ng100pjs',
        debug : true
    });

The connector argument passed the DataSource constructor can be one of the following:

* The connector module from `require(connectorName)`
* The full name of the connector module, such as 'loopback-connector-oracle'
* The short name of the connector module, such as 'oracle', which will be converted to 'loopback-connector-<shortName>'
* A local module under ./connectors/<connectorName> folder

## Generic connector implmentations

A connector module can implement the following methods to interact with the datasource.

    exports.initialize = function (dataSource, postInit) {

        var settings = dataSource.settings || {}; // The settings is passed in from the dataSource

        var connector = new MyConnector(settings); // Construct the connector instance
        dataSource.connector = connector; // Attach connector to dataSource
        connector.dataSource = dataSource; // Hold a reference to dataSource

        /**
         * Connector instance can have an optional property named as DataAccessObject that provides
         * static and prototype methods to be mixed into the model constructor. The property can be defined
         * on the prototype.
         */
        connector.DataAccessObject = function {};

        /**
         * Connector instance can have an optional function to be called to handle data model definitions.
         * The function can be defined on the prototype too.
         * @param model The name of the model
         * @param properties An object for property definitions keyed by propery names
         * @param settings An object for the model settings
         */
        connector.define = function(model, properties, settings) {
            ...
        };

        connector.connect(..., postInit); // Run some async code for initialization
        // process.nextTick(postInit);
    }

Another way is to directly export the connection function which takes a settings object.

    module.exports = function(settings) {
        ...
    }

## CRUD connector implmentations

To support CRUD operations for a model class that is attached to the dataSource/connector, the connector needs to provide
the following functions:

    /**
     * Create a new model instance
     */
    CRUDConnector.prototype.create = function (model, data, callback) {
    };

    /**
     * Save a model instance
     */
    CRUDConnector.prototype.save = function (model, data, callback) {
    };

    /**
     * Check if a model instance exists by id
     */
    CRUDConnector.prototype.exists = function (model, id, callback) {
    };

    /**
     * Find a model instance by id
     */
    CRUDConnector.prototype.find = function find(model, id, callback) {
    };

    /**
     * Update a model instance or create a new model instance if it doesn't exist
     */
    CRUDConnector.prototype.updateOrCreate = function updateOrCreate(model, data, callback) {
    };

    /**
     * Delete a model instance by id
     */
    CRUDConnector.prototype.destroy = function destroy(model, id, callback) {
    };

    /**
     * Query model instances by the filter
     */
    CRUDConnector.prototype.all = function all(model, filter, callback) {
    };

    /**
     * Delete all model instances
     */
    CRUDConnector.prototype.destroyAll = function destroyAll(model, callback) {
    };

    /**
     * Count the model instances by the where criteria
     */
    CRUDConnector.prototype.count = function count(model, callback, where) {
    };

    /**
     * Update the attributes for a model instance by id
     */
    CRUDConnector.prototype.updateAttributes = function updateAttrs(model, id, data, callback) {
    };




