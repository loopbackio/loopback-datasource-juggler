## LoopBack DataSource

LoopBack is centered around models, which represent data and behaviors. The concept of `DataSource` is introduced to
encapsulate business logic to exchange data between models and various sources. Data sources are typically databases
that provide create, retrieve, update, and delete (CRUD) functions. LoopBack also generalize other backend services,
such as REST APIs, SOAP Web Services, and Storage Services, as data sources.

Data sources are backed by connectors which implement the data exchange logic. Connectors are not used directly by
application code. The `DataSource` class provides APIs to configure a connector and exposes functions via `DataSource`
or model classes.

![model-datasource-connector](datasource-connector.png "LoopBack Model, DataSource, and Connector")

### Creating dataSource

The `DataSource` constructor available from `loopback-datasource-juggler` module:

    var DataSource = require('loopback-datasource-juggler').DataSource;

`DataSource` constructor accepts two arguments:
- connector: The name or instance of the connector module
- settings: An object of properties to configure the connector

    var dataSource = new DataSource({
        connector: require('loopback-connector-mongodb'),
        host: 'localhost',
        port: 27017,
        database: 'mydb'
    });

#### Connector

The connector argument passed the DataSource constructor can be one of the following:

* The connector module from `require(connectorName)`
* The full name of the connector module, such as 'loopback-connector-oracle'
* The short name of the connector module, such as 'oracle', which will be converted to 'loopback-connector-<shortName>'
* A local module under ./connectors/<connectorName> folder


    var ds1 = new DataSource('memory');
    var ds2 = new DataSource('loopback-connector-mongodb'));
    var ds3 = new DataSource(require('loopback-connector-oracle'));


#### Settings

The settings argument configures the connector. Settings object format and defaults
depends on specific connector, but common fields are:

* `host`: Database host
* `port`: Database port
* `username`: Username to connect to database
* `password`: Password to connect to database
* `database`: Database name
* `debug`: Turn on verbose mode to debug db queries and lifecycle

For connector-specific settings refer to connector's readme file.

### Using DataSource to create models

`DataSource` extends from `ModelBuilder`, which is a factory for plain model classes that only have properties.

DataSource is a factory for model classes. DataSource connected with specific database or other
backend system using connector.

    var ds = new DataSource('memory');
    var User = ds.define('User', {
        name: String,
        bio: String,
        approved: Boolean,
        joinedAt: Date,
        age: Number
    });

All model classes within single data source shares same connector type and one database
connection or connection pool. But it's possible to use more than one data source to connect with
different databases.

Alternatively, a plain model constructor created from `ModelBuilder` can be attached a `DataSource`.

    var ds = new DataSource('memory');
    User.attachTo(ds); // The CRUD methods will be mixed into the User constructor

What behaviors does data source add to the model? The methods are contributed by the underlying connector
through the data access object.

### Injecting behaviors to the model


### Connecting to database

DataSource connecting to database automatically. Once connection established dataSource
object emit 'connected' event, and set `connected` flag to true, but it is not
necessary to wait for 'connected' event because all queries cached and executed
when dataSource emit 'connected' event.

To disconnect from database server call `dataSource.disconnect` method. This call
forwarded to connector if connector have ability to connect/disconnect.

### Discovering model definitions from the database

### Synchronizing model definitions and database tables

DataSource instance have two methods for updating db structure: `automigrate` and `autoupdate` for relational
databases.

The `automigrate` method drop table (if exists) and create it again, `autoupdate` method generates
ALTER TABLE query. Both method accepts an optional array of model names and a callback function to be
called when migration/update done. If the `models` argument is not present, all models are checked.

To check if any db changes required use `isActual` method. It accepts
and a `callback` argument, which receive boolean value depending on db state:

- false if db structure outdated
- true when dataSource and db is in sync


    dataSource.isActual(models, function(err, actual) {
        if (!actual) {
            dataSource.autoupdate(models, function(err, result) {
                ...
            });
        }
    });

## LoopBack Connectors

|    Type   | Package Name                                                                           |
| --------- |:--------------------------------------------------------------------------------------:|
| MongoDB   | [loopback-connector-mongodb](https://github.com/strongloop/loopback-connector-mongodb) |
| Oracle    | [loopback-connector-oracle](https://github.com/strongloop/loopback-connector-oracle)   |
| MySQL     | [loopback-connector-mysql](https://github.com/strongloop/loopback-connector-mysql)     |

## Build your own connector

LoopBack connectors provide access to backend systems including databases, REST APIs
and other services. Connectors are not used directly by application code. We create
a DataSource to interact with the connector.

For example,

    var DataSource = require('loopback-datasource-juggler').DataSource;
    var oracleConnector = require('loopback-connector-oracle');

    var ds = new DataSource(oracleConnector, {
        host : 'localhost',
        database : 'XE',
        username : 'strongloop',
        password : 'strongloop',
        debug : true
    });


## Generic connector implementations

A connector module can implement the following methods to interact with the data source.

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

## CRUD connector implementations

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





