# loopback-data-datasource

Everything about datasource, data types and model definition.

## DESCRIPTION

DataSource is a factory for model classes. DataSource connected with specific database or other
backend system using connector.

All model classes within single datasource shares same connector type and one database
connection. But it's possible to use more than one datasource to connect with
different databases.

## EVENTS

Instances of DataSource are event emitters, events supported by default:

* `.on('connected', function() {})`:
  Fired when db connection established. Params: none.
* `.on('log', function(msg, duration) {})`:
  Fired when connector logged line. Params: String message, Number duration

## USAGE

### Creating dataSource

`DataSource` constructor available on `loopback-data` module:

    var DataSource = require('loopback-data').DataSource;

DataSource constructor accepts two arguments. First argument is connector. It could be
connector name or connector package:

    var dataSourceByConnectorName = new DataSource('memory');
    var dataSourceByConnectorModule = new DataSource(require('redis'));

### Settings

Second argument is optional settings. Settings object format and defaults
depends on specific connector, but common fields are:

* `host`:
Database host
* `port`:
Database port
* `username`:
Username to connect to database
* `password`:
Password to connect to database
* `database`:
Database name
* `debug`:
Turn on verbose mode to debug db queries and lifecycle

For connector-specific settings refer to connector's readme file.

### Connecting to database

DataSource connecting to database automatically. Once connection established dataSource
object emit 'connected' event, and set `connected` flag to true, but it is not
necessary to wait for 'connected' event because all queries cached and executed
when dataSource emit 'connected' event.

To disconnect from database server call `dataSource.disconnect` method. This call
forwarded to connector if connector have ability to connect/disconnect.

### Model definition

To define model dataSource have single method `dataSource.define`. It accepts three
argumets:

* **model name**:
  String name in camel-case with first upper-case letter. This name will be used
  later to access model.
* **properties**:
  Object with property type definitions. Key is property name, value is type
  definition. Type definition can be function representing type of property
  (String, Number, Date, Boolean), or object with {type: String|Number|...,
  index: true|false} format.
* **settings**:
  Object with model-wide settings such as `tableName` or so.

Examples of model definition:

    var User = dataSource.define('User', {
        email: String,
        password: String,
        birthDate: Date,
        activated: Boolean
    });

    var User = dataSource.define('User', {
        email: { type: String, limit: 150, index: true },
        password: { type: String, limit: 50 },
        birthDate: Date,
        registrationDate: {
            type: Date,
            default: function () { return new Date }
        },
        activated: { type: Boolean, default: false }
    }, {
        tableName: 'users'
    });

### DB structure syncronization

DataSource instance have two methods for updating db structure: automigrate and
autoupdate.

The `automigrate` method drop table (if exists) and create it again,
`autoupdate` method generates ALTER TABLE query. Both method accepts callback
called when migration/update done.

To check if any db changes required use `isActual` method. It accepts single
`callback` argument, which receive boolean value depending on db state: false if
db structure outdated, true when dataSource and db is in sync:

    dataSource.isActual(function(err, actual) {
        if (!actual) {
            dataSource.autoupdate();
        }
    });

## SEE ALSO

loopback-data-model
loopback-data-connector
