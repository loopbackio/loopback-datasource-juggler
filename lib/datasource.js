/*!
 * Module dependencies
 */
var ModelBuilder = require('./model-builder.js').ModelBuilder;
var ModelDefinition = require('./model-definition.js');
var jutil = require('./jutil');
var utils = require('./utils');
var ModelBaseClass = require('./model.js');
var DataAccessObject = require('./dao.js');
var List = require('./list.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var path = require('path');
var fs = require('fs');
var async = require('async');

var existsSync = fs.existsSync || path.existsSync;

/**
 * Export public API
 */
exports.DataSource = DataSource;

/*!
 * Helpers
 */
var slice = Array.prototype.slice;

/**
 * DataSource - connector-specific classes factory.
 *
 * All classes in single dataSource shares same connector type and
 * one database connection
 *
 * @param {String} name - type of dataSource connector (mysql, mongoose, oracle, redis)
 * @param {Object} settings - any database-specific settings which we need to
 * establish connection (of course it depends on specific connector)
 *
 * - host
 * - port
 * - username
 * - password
 * - database
 * - debug {Boolean} = false
 *
 * @example DataSource creation, waiting for connection callback
 * ```
 * var dataSource = new DataSource('mysql', { database: 'myapp_test' });
 * dataSource.define(...);
 * dataSource.on('connected', function () {
 *     // work with database
 * });
 * ```
 */
function DataSource(name, settings) {
    if (!(this instanceof DataSource)) {
        return new DataSource(name, settings);
    }

    // Check if the settings object is passed as the first argument
    if (typeof name === 'object' && settings === undefined) {
        settings = name;
        name = undefined;
    }

    // Check if the first argument is a URL
    if(typeof name === 'string' && name.indexOf('://') !== -1 ) {
        name = utils.parseSettings(name);
    }

    // Check if the settings is in the form of URL string
    if(typeof settings === 'string' && settings.indexOf('://') !== -1 ) {
        settings = utils.parseSettings(settings);
    }

    ModelBuilder.call(this, name, settings);

    // operation metadata
    // Initialize it before calling setup as the connector might register operations
    this._operations = {};

    this.setup(name, settings);

    this._setupConnector();

    // connector
    var connector = this.connector;
    
    // DataAccessObject - connector defined or supply the default
    this.DataAccessObject = (connector && connector.DataAccessObject) ? connector.DataAccessObject : this.constructor.DataAccessObject;
    this.DataAccessObject.apply(this, arguments);
    

    // define DataAccessObject methods
    Object.keys(this.DataAccessObject).forEach(function (name) {
      var fn = this.DataAccessObject[name];
      
      if(typeof fn === 'function') {
        this.defineOperation(name, {
          accepts: fn.accepts, 
          'returns': fn.returns,
          http: fn.http,
          remoteEnabled: fn.shared ? true : false,
          scope: this.DataAccessObject,
          fnName: name
        });
      }
    }.bind(this));
    
    // define DataAccessObject.prototype methods
    Object.keys(this.DataAccessObject.prototype).forEach(function (name) {
      var fn = this.DataAccessObject.prototype[name];
      
      if(typeof fn === 'function') {
        var returns = fn.returns;
        
        this.defineOperation(name, {
          prototype: true,
          accepts: fn.accepts, 
          'returns': fn.returns,
          http: fn.http,
          remoteEnabled: fn.shared ? true : false,
          scope: this.DataAccessObject.prototype,
          fnName: name
        });
      }
    }.bind(this));
}

util.inherits(DataSource, ModelBuilder);

// allow child classes to supply a data access object
DataSource.DataAccessObject = DataAccessObject;

// Copy over statics
for (var m in ModelBuilder) {
    if (!DataSource.hasOwnProperty(m) && 'super_' !== m) {
        DataSource[m] = ModelBuilder[m];
    }
}

/**
 * Set up the connector instance for backward compatibility with JugglingDB schema/adapter
 * @private
 */
DataSource.prototype._setupConnector = function () {
    this.connector = this.connector || this.adapter; // The legacy JugglingDB adapter will set up `adapter` property
    this.adapter = this.connector; // Keep the adapter as an alias to connector
    if (this.connector) {
        if (!this.connector.dataSource) {
            // Set up the dataSource if the connector doesn't do so
            this.connector.dataSource = this;
        }
        var dataSource = this;
        this.connector.log = function (query, start) {
            dataSource.log(query, start);
        };

        this.connector.logger = function (query) {
            var t1 = Date.now();
            var log = this.log;
            return function (q) {
                log(q || query, t1);
            };
        };
    }
};

/**
 * Set up the data source
 * @param {String} name The name
 * @param {Object} settings The settings
 * @returns {*}
 * @private
 */
DataSource.prototype.setup = function(name, settings) {
    var dataSource = this;
    var connector;

    // support single settings object
    if(name && typeof name === 'object' && !settings) {
        settings = name;
        name = undefined;
    }

    if(typeof settings === 'object') {
      if(settings.initialize) {
        connector = settings;
      } else if(settings.connector) {
        connector = settings.connector;
      } else if(settings.adapter) {
        connector = settings.adapter;
      }
    }
    
    // just save everything we get
    this.settings = settings || {};

    // Check the debug env settings
    var debugEnv = process.env.DEBUG || process.env.NODE_DEBUG || '';
    var debugModules = debugEnv.split(/[\s,]+/);
    if(debugModules.indexOf('loopback') !== -1) {
        this.settings.debug = true;
    }

    // Disconnected by default
    this.connected = false;
    this.connecting = false;

    if(typeof connector === 'string') {
        name = connector;
        connector = undefined;
    }
    name = name || (connector && connector.name);
    this.name = name;

    if (name && !connector) {
        if (typeof name === 'object') {
            // The first argument might be the connector itself
            connector = name;
            this.name = connector.name;
        }
        // The connector has not been resolved
        else if (name.match(/^\//)) {
            // try absolute path
            connector = require(name);
        } else if (existsSync(__dirname + '/connectors/' + name + '.js')) {
            // try built-in connector
            connector = require('./connectors/' + name);
        } else {
            // try foreign connector
            try {
                if(name.indexOf('loopback-connector-') === -1) {
                    name = 'loopback-connector-' + name;
                }
                connector = require(name);
            } catch (e) {
                return console.log('\nWARNING: LoopbackData connector "' + name + '" is not installed,\nso your models would not work, to fix run:\n\n    npm install ' + name, '\n');
            }
        }
    }

    if (connector) {
        var postInit = function postInit(err, result) {

            this._setupConnector();
            // we have an connector now?
            if (!this.connector) {
                throw new Error('Connector is not defined correctly: it should create `connector` member of dataSource');
            }
            this.connected = !err; // Connected now
            if(this.connected) {
                this.emit('connected');
            } else {
                // The connection fails, let's report it and hope it will be recovered in the next call
                console.error('Connection fails: ', err, '\nIt will be retried for the next request.');
                this.connecting = false;
            }

        }.bind(this);

        if ('function' === typeof connector.initialize) {
            // Call the async initialize method
            connector.initialize(this, postInit);
        } else if('function' === typeof connector) {
            // Use the connector constructor directly
            this.connector = new connector(this.settings);
            postInit();
        }
    }

    dataSource.connect = function(cb) {
        var dataSource = this;
        if(dataSource.connected || dataSource.connecting) {
            process.nextTick(function() {
                cb && cb();
            });
            return;
        }
        dataSource.connecting = true;
        if (dataSource.connector.connect) {
            dataSource.connector.connect(function(err, result) {
                if (!err) {
                    dataSource.connected = true;
                    dataSource.connecting = false;
                    dataSource.emit('connected');
                } else {
                    dataSource.connected = false;
                    dataSource.connecting = false;
                    dataSource.emit('error', err);
                }
                cb && cb(err, result);
            });
        } else {
            process.nextTick(function() {
                dataSource.connected = true;
                dataSource.connecting = false;
                dataSource.emit('connected');
                cb && cb();
            });
        }
    };
};

/**
 * Define a model class
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
 * var User = dataSource.define('User', {
 *     email: String,
 *     password: String,
 *     birthDate: Date,
 *     activated: Boolean
 * });
 * ```
 * @example more advanced case
 * ```
 * var User = dataSource.define('User', {
 *     email: { type: String, limit: 150, index: true },
 *     password: { type: String, limit: 50 },
 *     birthDate: Date,
 *     registrationDate: {type: Date, default: function () { return new Date }},
 *     activated: { type: Boolean, default: false }
 * });
 * ```
 */

DataSource.prototype.createModel = DataSource.prototype.define = function defineClass(className, properties, settings) {
    var args = slice.call(arguments);

    if (!className) {
        throw new Error('Class name required');
    }
    if (args.length === 1) {
        properties = {};
        args.push(properties);
    }
    if (args.length === 2) {
        settings   = {};
        args.push(settings);
    }

    properties = properties || {};
    settings = settings || {};

    if(this.isRelational()) {
        // Set the strict mode to be true for relational DBs by default
        if(settings.strict === undefined || settings.strict === null) {
            settings.strict = true;
        }
        if(settings.strict === false) {
            settings.strict = 'throw';
        }
    }

    var NewClass = ModelBuilder.prototype.define.call(this, className, properties, settings);

    // add data access objects
    this.mixin(NewClass);

    if(this.connector && this.connector.define) {
        // pass control to connector
        this.connector.define({
            model: NewClass,
            properties: NewClass.definition.properties,
            settings: settings
        });
    }

    return NewClass;
};


/**
 * Mixin DataAccessObject methods.
 *
 * @param {Function} ModelCtor The model constructor
 */

DataSource.prototype.mixin = function (ModelCtor) {
  var ops = this.operations();
  var DAO = this.DataAccessObject;
  
  // mixin DAO
  jutil.mixin(ModelCtor, DAO);
  
  // decorate operations as alias functions
  Object.keys(ops).forEach(function (name) {
    var op = ops[name];
    var scope;

    if(op.enabled) {
      scope = op.prototype ? ModelCtor.prototype : ModelCtor;
      // var sfn = scope[name] = function () {
      //   op.scope[op.fnName].apply(self, arguments);
      // }
      Object.keys(op)
        .filter(function (key) {
          // filter out the following keys
          return ~ [
            'scope',
            'fnName',
            'prototype'
          ].indexOf(key);
        })
        .forEach(function (key) {
          if(typeof op[key] !== 'undefined') {
            op.scope[op.fnName][key] = op[key];
          }
        });
    }
  });
};

/**
 * Attach an existing model to a data source.
 *
 * @param {Function} ModelCtor The model constructor
 */

DataSource.prototype.attach = function (ModelCtor) {
  if(ModelCtor.dataSource === this) {
    // Already attached to the data source
    return;
  }
  var className = ModelCtor.modelName;
  var properties = ModelCtor.dataSource.definitions[className].properties;
  var settings = ModelCtor.dataSource.definitions[className].settings;

  // redefine the dataSource
  ModelCtor.dataSource = this;
  // add to def
  var def = new ModelDefinition(this, className, properties, settings);
  def.build();
  this.definitions[className] = def;
  this.models[className] = ModelCtor;

  this.mixin(ModelCtor);

  if(this.connector && this.connector.define) {
    // pass control to connector
    this.connector.define({
        model: ModelCtor,
        properties: properties,
        settings: settings
    });
  }

  return this;
};

/**
 * Define single property named `prop` on `model`
 *
 * @param {String} model - name of model
 * @param {String} prop - name of propery
 * @param {Object} params - property settings
 */
DataSource.prototype.defineProperty = function (model, prop, params) {
    ModelBuilder.prototype.defineProperty.call(this, model, prop, params);

    var resolvedProp = this.definitions[model].properties[prop];
    if (this.connector.defineProperty) {
        this.connector.defineProperty(model, prop, resolvedProp);
    }
};

/**
 * Drop each model table and re-create.
 * This method make sense only for sql connectors.
 *
 * @param {String} or {[String]} Models to be migrated, if not present, apply to all models
 * @param {Function} [cb] The callback function
 *
 * @warning All data will be lost! Use autoupdate if you need your data.
 */
DataSource.prototype.automigrate = function (models, cb) {
    this.freeze();
    if (this.connector.automigrate) {
        this.connector.automigrate(models, cb);
    } else {
        if ((!cb) && ('function' === typeof models)) {
            cb = models;
            models = undefined;
        }
        cb && process.nextTick(cb);
    }
};

/**
 * Update existing database tables.
 * This method make sense only for sql connectors.
 *
 * @param {String} or {[String]} Models to be migrated, if not present, apply to all models
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.autoupdate = function (models, cb) {
    this.freeze();
    if (this.connector.autoupdate) {
        this.connector.autoupdate(models, cb);
    } else {
        if ((!cb) && ('function' === typeof models)) {
            cb = models;
            models = undefined;
        }
        cb && process.nextTick(cb);
    }
};

/**
 * Discover existing database tables.
 * This method returns an array of model objects, including {type, name, onwer}
 *
 * `options`
 *
 *      all: true - Discovering all models, false - Discovering the models owned by the current user
 *      views: true - Including views, false - only tables
 *      limit: The page size
 *      offset: The starting index
 *
 * @param {Object} options The options
 * @param {Function} [cb] The callback function
 *
 */
DataSource.prototype.discoverModelDefinitions = function (options, cb) {
    this.freeze();
    if (this.connector.discoverModelDefinitions) {
        this.connector.discoverModelDefinitions(options, cb);
    } else if (cb) {
        cb();
    }
};


/**
 * The synchronous version of discoverModelDefinitions
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverModelDefinitionsSync = function (options) {
    this.freeze();
    if (this.connector.discoverModelDefinitionsSync) {
        return this.connector.discoverModelDefinitionsSync(options);
    }
    return null;
};

/**
 * Discover properties for a given model.
 *
 * `property description`
 *
 *      owner {String} The database owner or schema
 *      tableName {String} The table/view name
 *      columnName {String} The column name
 *      dataType {String} The data type
 *      dataLength {Number} The data length
 *      dataPrecision {Number} The numeric data precision
 *      dataScale {Number} The numeric data scale
 *      nullable {Boolean} If the data can be null
 *
 * `options`
 *
 *      owner/schema The database owner/schema
 *
 * @param {String} modelName The table/view name
 * @param {Object} options The options
 * @param {Function} [cb] The callback function
 *
 */
DataSource.prototype.discoverModelProperties = function (modelName, options, cb) {
  this.freeze();
  if (this.connector.discoverModelProperties) {
      this.connector.discoverModelProperties(modelName, options, cb);
  } else if (cb) {
      cb();
  }
};

/**
 * The synchronous version of discoverModelProperties
 * @param {String} modelName The table/view name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverModelPropertiesSync = function (modelName, options) {
    this.freeze();
    if (this.connector.discoverModelPropertiesSync) {
        return this.connector.discoverModelPropertiesSync(modelName, options);
    }
    return null;
};

/**
 * Discover primary keys for a given owner/modelName
 *
 * Each primary key column description has the following columns:
 *
 *      owner {String} => table schema (may be null)
 *      tableName {String} => table name
 *      columnName {String} => column name
 *      keySeq {Number} => sequence number within primary key( a value of 1 represents the first column of the primary key, a value of 2 would represent the second column within the primary key).
 *      pkName {String} => primary key name (may be null)
 *
 *      The owner, default to current user
 *
 * `options`
 *
 *      owner/schema The database owner/schema
 *
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.discoverPrimaryKeys= function(modelName, options, cb) {
    this.freeze();
    if (this.connector.discoverPrimaryKeys) {
        this.connector.discoverPrimaryKeys(modelName, options, cb);
    } else if (cb) {
        cb();
    }
};

/**
 * The synchronous version of discoverPrimaryKeys
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverPrimaryKeysSync= function(modelName, options) {
    this.freeze();
    if (this.connector.discoverPrimaryKeysSync) {
        return this.connector.discoverPrimaryKeysSync(modelName, options);
    }
    return null;
};

/**
 * Discover foreign keys for a given owner/modelName
 *
 * `foreign key description`
 *
 *      fkOwner String => foreign key table schema (may be null)
 *      fkName String => foreign key name (may be null)
 *      fkTableName String => foreign key table name
 *      fkColumnName String => foreign key column name
 *      keySeq Number => sequence number within a foreign key( a value of 1 represents the first column of the foreign key, a value of 2 would represent the second column within the foreign key).
 *      pkOwner String => primary key table schema being imported (may be null)
 *      pkName String => primary key name (may be null)
 *      pkTableName String => primary key table name being imported
 *      pkColumnName String => primary key column name being imported
 *
 * `options`
 *
 *      owner/schema The database owner/schema
 *
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @param {Function} [cb] The callback function
 *
 */
DataSource.prototype.discoverForeignKeys= function(modelName, options, cb) {
    this.freeze();
    if (this.connector.discoverForeignKeys) {
        this.connector.discoverForeignKeys(modelName, options, cb);
    } else if (cb) {
        cb();
    }
};

/**
 * The synchronous version of discoverForeignKeys
 *
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverForeignKeysSync= function(modelName, options) {
    this.freeze();
    if (this.connector.discoverForeignKeysSync) {
        return this.connector.discoverForeignKeysSync(modelName, options);
    }
    return null;
}

/**
 * Retrieves a description of the foreign key columns that reference the given table's primary key columns (the foreign keys exported by a table).
 * They are ordered by fkTableOwner, fkTableName, and keySeq.
 *
 * `foreign key description`
 *
 *      fkOwner {String} => foreign key table schema (may be null)
 *      fkName {String} => foreign key name (may be null)
 *      fkTableName {String} => foreign key table name
 *      fkColumnName {String} => foreign key column name
 *      keySeq {Number} => sequence number within a foreign key( a value of 1 represents the first column of the foreign key, a value of 2 would represent the second column within the foreign key).
 *      pkOwner {String} => primary key table schema being imported (may be null)
 *      pkName {String} => primary key name (may be null)
 *      pkTableName {String} => primary key table name being imported
 *      pkColumnName {String} => primary key column name being imported
 *
 * `options`
 *
 *      owner/schema The database owner/schema
 *
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.discoverExportedForeignKeys= function(modelName, options, cb) {
    this.freeze();
    if (this.connector.discoverExportedForeignKeys) {
        this.connector.discoverExportedForeignKeys(modelName, options, cb);
    } else if (cb) {
        cb();
    }
};

/**
 * The synchronous version of discoverExportedForeignKeys
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverExportedForeignKeysSync= function(modelName, options) {
    this.freeze();
    if (this.connector.discoverExportedForeignKeysSync) {
        return this.connector.discoverExportedForeignKeysSync(modelName, options);
    }
    return null;
}

function capitalize(str) {
    if (!str) {
        return str;
    }
    return str.charAt(0).toUpperCase() + ((str.length > 1) ? str.slice(1).toLowerCase() : '');
}

function fromDBName(dbName, camelCase) {
    if (!dbName) {
        return dbName;
    }
    var parts = dbName.split(/-|_/);
    parts[0] = camelCase ? parts[0].toLowerCase() : capitalize(parts[0]);

    for (var i = 1; i < parts.length; i++) {
        parts[i] = capitalize(parts[i]);
    }
    return parts.join('');
}

/**
 * Discover one schema from the given model without following the associations
 *
 * @param {String} modelName The model name
 * @param {Object} [options] The options
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.discoverSchema = function (modelName, options, cb) {
    options = options || {};

    if(!cb && 'function' === typeof options) {
        cb = options;
        options = {};
    }
    options.visited = {};
    options.associations = false;

    this.discoverSchemas(modelName, options, function(err, schemas) {
        if(err) {
            cb && cb(err, schemas);
            return;
        }
        for(var s in schemas) {
            cb && cb(null, schemas[s]);
            return;
        }
    });
}

/**
 * Discover schema from a given modelName/view
 *
 * `options`
 *
 *      {String} owner/schema - The database owner/schema name
 *      {Boolean} associations - If relations (primary key/foreign key) are navigated
 *      {Boolean} all - If all owners are included
 *      {Boolean} views - If views are included
 *
 * @param {String} modelName The model name
 * @param {Object} [options] The options
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.discoverSchemas = function (modelName, options, cb) {
    options = options || {};

    if(!cb && 'function' === typeof options) {
        cb = options;
        options = {};
    }

    var self = this;
    var schemaName = this.name || this.connector.name;

    var tasks = [
        this.discoverModelProperties.bind(this, modelName, options),
        this.discoverPrimaryKeys.bind(this, modelName, options) ];

    if (options.associations) {
        tasks.push(this.discoverForeignKeys.bind(this, modelName, options));
    }

    async.parallel(tasks, function (err, results) {

        if (err) {
            cb && cb(err);
            return;
        }

        var columns = results[0];
        if (!columns || columns.length === 0) {
            cb && cb();
            return;
        }

        // Handle primary keys
        var primaryKeys = results[1];
        var pks = {};
        primaryKeys.forEach(function (pk) {
            pks[pk.columnName] = pk.keySeq;
        });

        if (self.settings.debug) {
            console.log('Primary keys: ', pks);
        }

        var schema = {
            name: fromDBName(modelName, false),
            options: {
                idInjection: false // DO NOT add id property
            },
            properties: {
            }
        };

        schema.options[schemaName] = {
            schema: columns[0].owner,
            table: modelName
        };

        columns.forEach(function (item) {
            var i = item;

            var propName = fromDBName(item.columnName, true);
            schema.properties[propName] = {
                type: item.type,
                required: (item.nullable === 'N'),
                length: item.dataLength,
                precision: item.dataPrecision,
                scale: item.dataScale
            };

            if (pks[item.columnName]) {
                schema.properties[propName].id = pks[item.columnName];
            }
            schema.properties[propName][schemaName] = {
                columnName: i.columnName,
                dataType: i.dataType,
                dataLength: i.dataLength,
                dataPrecision: item.dataPrecision,
                dataScale: item.dataScale,
                nullable: i.nullable
            };
        });

        // Add current modelName to the visited tables
        options.visited = options.visited || {};
        var schemaKey = columns[0].owner + '.' + modelName;
        if (!options.visited.hasOwnProperty(schemaKey)) {
            if(self.settings.debug) {
                console.log('Adding schema for ' + schemaKey);
            }
            options.visited[schemaKey] = schema;
        }

        var otherTables = {};
        if (options.associations) {
            // Handle foreign keys
            var fks = {};
            var foreignKeys = results[2];
            foreignKeys.forEach(function (fk) {
                var fkInfo = {
                    keySeq: fk.keySeq,
                    owner: fk.pkOwner,
                    tableName: fk.pkTableName,
                    columnName: fk.pkColumnName
                };
                if (fks[fk.fkName]) {
                    fks[fk.fkName].push(fkInfo);
                } else {
                    fks[fk.fkName] = [fkInfo];
                }
            });

            if (self.settings.debug) {
                console.log('Foreign keys: ', fks);
            }

            foreignKeys.forEach(function (fk) {
                var propName = fromDBName(fk.pkTableName, true);
                schema.properties[propName] = {
                  type: fromDBName(fk.pkTableName, false),
                  association: {
                      type: 'belongsTo',
                      foreignKey: fromDBName(fk.pkColumnName, true)
                  }
                };

                var key = fk.pkOwner + '.' + fk.pkTableName;
                if (!options.visited.hasOwnProperty(key) && !otherTables.hasOwnProperty(key)) {
                    otherTables[key] = {owner: fk.pkOwner, tableName: fk.pkTableName};
                }
            });
        }

        if (Object.keys(otherTables).length === 0) {
            cb && cb(null, options.visited);
        } else {
            var moreTasks = [];
            for (var t in otherTables) {
                if(self.settings.debug) {
                    console.log('Discovering related schema for ' + schemaKey);
                }
                var newOptions = {};
                for(var key in options) {
                    newOptions[key] = options[key];
                }
                newOptions.owner = otherTables[t].owner;

                moreTasks.push(DataSource.prototype.discoverSchemas.bind(self, otherTables[t].tableName, newOptions));
            }
            async.parallel(moreTasks, function (err, results) {
                var result = results && results[0];
                cb && cb(err, result);
            });
        }
    });
};


/**
 * Discover schema from a given table/view synchronously
 *
 * `options`
 *
 *      {String} owner/schema - The database owner/schema name
 *      {Boolean} associations - If relations (primary key/foreign key) are navigated
 *      {Boolean} all - If all owners are included
 *      {Boolean} views - If views are included
 *
 * @param {String} modelName The model name
 * @param {Object} [options] The options
 */
DataSource.prototype.discoverSchemasSync = function (modelName, options) {
    var self = this;
    var schemaName = this.name || this.connector.name;

    var columns = this.discoverModelPropertiesSync(modelName, options);
    if (!columns || columns.length === 0) {
        return [];
    }

    // Handle primary keys
    var primaryKeys = this.discoverPrimaryKeysSync(modelName, options);
    var pks = {};
    primaryKeys.forEach(function (pk) {
        pks[pk.columnName] = pk.keySeq;
    });

    if (self.settings.debug) {
        console.log('Primary keys: ', pks);
    }

    var schema = {
        name: fromDBName(modelName, false),
        options: {
            idInjection: false // DO NOT add id property
        },
        properties: {
        }
    };

    schema.options[schemaName] = {
        schema: columns.length > 0 && columns[0].owner,
        table: modelName
    };

    columns.forEach(function (item) {
        var i = item;

        var propName = fromDBName(item.columnName, true);
        schema.properties[propName] = {
            type: item.type,
            required: (item.nullable === 'N'),
            length: item.dataLength,
            precision: item.dataPrecision,
            scale: item.dataScale
        };

        if (pks[item.columnName]) {
            schema.properties[propName].id = pks[item.columnName];
        }
        schema.properties[propName][schemaName] = {
            columnName: i.columnName,
            dataType: i.dataType,
            dataLength: i.dataLength,
            dataPrecision: item.dataPrecision,
            dataScale: item.dataScale,
            nullable: i.nullable
        };
    });

    // Add current modelName to the visited tables
    options.visited = options.visited || {};
    var schemaKey = columns[0].owner + '.' + modelName;
    if (!options.visited.hasOwnProperty(schemaKey)) {
        if (self.settings.debug) {
            console.log('Adding schema for ' + schemaKey);
        }
        options.visited[schemaKey] = schema;
    }

    var otherTables = {};
    if (options.associations) {
        // Handle foreign keys
        var fks = {};
        var foreignKeys = this.discoverForeignKeysSync(modelName, options);
        foreignKeys.forEach(function (fk) {
            var fkInfo = {
                keySeq: fk.keySeq,
                owner: fk.pkOwner,
                tableName: fk.pkTableName,
                columnName: fk.pkColumnName
            };
            if (fks[fk.fkName]) {
                fks[fk.fkName].push(fkInfo);
            } else {
                fks[fk.fkName] = [fkInfo];
            }
        });

        if (self.settings.debug) {
            console.log('Foreign keys: ', fks);
        }

        foreignKeys.forEach(function (fk) {
            var propName = fromDBName(fk.pkTableName, true);
            schema.properties[propName] = {
                type: fromDBName(fk.pkTableName, false),
                association: {
                    type: 'belongsTo',
                    foreignKey: fromDBName(fk.pkColumnName, true)
                }
            };

            var key = fk.pkOwner + '.' + fk.pkTableName;
            if (!options.visited.hasOwnProperty(key) && !otherTables.hasOwnProperty(key)) {
                otherTables[key] = {owner: fk.pkOwner, tableName: fk.pkTableName};
            }
        });
    }

    if (Object.keys(otherTables).length === 0) {
        return options.visited;
    } else {
        var moreTasks = [];
        for (var t in otherTables) {
            if (self.settings.debug) {
                console.log('Discovering related schema for ' + schemaKey);
            }
            var newOptions = {};
            for(var key in options) {
                newOptions[key] = options[key];
            }
            newOptions.owner = otherTables[t].owner;
            self.discoverSchemasSync(otherTables[t].tableName, newOptions);
        }
        return options.visited;

    }
};

/**
 * Discover and build models from the given owner/modelName
 *
 *  `options`
 *
 *      {String} owner/schema - The database owner/schema name
 *      {Boolean} associations - If relations (primary key/foreign key) are navigated
 *      {Boolean} all - If all owners are included
 *      {Boolean} views - If views are included
 *
 * @param {String} modelName The model name
 * @param {Object} [options] The options
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.discoverAndBuildModels = function (modelName, options, cb) {
    var self = this;
    this.discoverSchemas(modelName, options, function (err, schemas) {
        if (err) {
            cb && cb(err, schemas);
            return;
        }

        var schemaList = [];
        for (var s in schemas) {
            var schema = schemas[s];
            schemaList.push(schema);
        }

        var models = self.buildModels(schemaList);
        cb && cb(err, models);
    });
};

/**
 * Discover and build models from the given owner/modelName synchronously
 *
 * `options`
 *
 *      {String} owner/schema - The database owner/schema name
 *      {Boolean} associations - If relations (primary key/foreign key) are navigated
 *      {Boolean} all - If all owners are included
 *      {Boolean} views - If views are included
 *
 * @param {String} modelName The model name
 * @param {Object} [options] The options
 */
DataSource.prototype.discoverAndBuildModelsSync = function (modelName, options) {
    var schemas = this.discoverSchemasSync(modelName, options);

    var schemaList = [];
    for (var s in schemas) {
        var schema = schemas[s];
        schemaList.push(schema);
    }

    var models = this.buildModels(schemaList);
    return models;
};

/**
 * Check whether migrations needed
 * This method make sense only for sql connectors.
 * @param {String[]} [models] A model name or an array of model names. If not present, apply to all models
 */
DataSource.prototype.isActual = function (models, cb) {
    this.freeze();
    if (this.connector.isActual) {
        this.connector.isActual(models, cb);
    } else {
        if ((!cb) && ('function' === typeof models)) {
            cb = models;
            models = undefined;
        }
        if (cb) {
            process.nextTick(function() {
                cb(null, true);
            });
        }
    }
};

/**
 * Log benchmarked message. Do not redefine this method, if you need to grab
 * chema logs, use `dataSource.on('log', ...)` emitter event
 *
 * @private used by connectors
 */
DataSource.prototype.log = function (sql, t) {
    this.emit('log', sql, t);
};

/**
 * Freeze dataSource. Behavior depends on connector
 */
DataSource.prototype.freeze = function freeze() {
    if (this.connector.freezeDataSource) {
        this.connector.freezeDataSource();
    }
    if (this.connector.freezeSchema) {
        this.connector.freezeSchema();
    }
}

/**
 * Return table name for specified `modelName`
 * @param {String} modelName The model name
 */
DataSource.prototype.tableName = function (modelName) {
    return this.definitions[modelName].tableName(this.connector.name);
};

/**
 * Return column name for specified modelName and propertyName
 * @param {String} modelName The model name
 * @param propertyName The property name
 * @returns {String} columnName
 */
DataSource.prototype.columnName = function (modelName, propertyName) {
    return this.definitions[modelName].columnName(this.connector.name, propertyName);
};

/**
 * Return column metadata for specified modelName and propertyName
 * @param {String} modelName The model name
 * @param propertyName The property name
 * @returns {Object} column metadata
 */
DataSource.prototype.columnMetadata = function (modelName, propertyName) {
    return this.definitions[modelName].columnMetadata(this.connector.name, propertyName);
};

/**
 * Return column names for specified modelName
 * @param {String} modelName The model name
 * @returns {String[]} column names
 */
DataSource.prototype.columnNames = function (modelName) {
    return this.definitions[modelName].columnNames(this.connector.name);
};

/**
 * Find the ID column name
 * @param {String} modelName The model name
 * @returns {String} columnName for ID
 */
DataSource.prototype.idColumnName = function(modelName) {
    return this.definitions[modelName].idColumnName(this.connector.name);
};

/**
 * Find the ID property name
 * @param {String} modelName The model name
 * @returns {String} property name for ID
 */
DataSource.prototype.idName = function(modelName) {
    if(!this.definitions[modelName].idName) {
    console.log(this.definitions[modelName]);
    }
    return this.definitions[modelName].idName();
};

/**
 * Find the ID property names sorted by the index
 * @param {String} modelName The model name
 * @returns {String[]} property names for IDs
 */
DataSource.prototype.idNames = function (modelName) {
    return this.definitions[modelName].idNames();
};


/**
 * Define foreign key to another model
 * @param {String} className The model name that owns the key
 * @param {String} key - name of key field
 * @param {String} foreignClassName The foreign model name
 */
DataSource.prototype.defineForeignKey = function defineForeignKey(className, key, foreignClassName) {
    // quit if key already defined
    if (this.definitions[className].rawProperties[key]) return;

    if (this.connector.defineForeignKey) {
        var cb = function (err, keyType) {
            if (err) throw err;
            // Add the foreign key property to the data source _models
            this.defineProperty(className, key, {type: keyType || Number});
        }.bind(this);
        switch (this.connector.defineForeignKey.length) {
            case 4:
                this.connector.defineForeignKey(className, key, foreignClassName, cb);
            break;
            default:
            case 3:
                this.connector.defineForeignKey(className, key, cb);
            break;
        }
    } else {
        // Add the foreign key property to the data source _models
        this.defineProperty(className, key, {type: Number});
    }

};

/**
 * Close database connection
 * @param {Fucntion} [cb] The callback function
 */
DataSource.prototype.disconnect = function disconnect(cb) {
    var self = this;
    if (this.connected && (typeof this.connector.disconnect === 'function')) {
        this.connector.disconnect(function(err, result) {
            self.connected = false;
            cb && cb(err, result);
        });
    } else {
        process.nextTick(function() {
           cb && cb();
        });
    }
};

/**
 * Copy the model from Master
 * @param {Function} Master The model constructor
 * @returns {Function} The copy of the model constructor
 *
 * @private
 */
DataSource.prototype.copyModel = function copyModel(Master) {
    var dataSource = this;
    var className = Master.modelName;
    var md = Master.dataSource.definitions[className];
    var Slave = function SlaveModel() {
        Master.apply(this, [].slice.call(arguments));
        this.dataSource = dataSource;
    };

    util.inherits(Slave, Master);

    // Delegating static properties
    Slave.__proto__ = Master;

    hiddenProperty(Slave, 'dataSource', dataSource);
    hiddenProperty(Slave, 'modelName', className);
    hiddenProperty(Slave, 'relations', Master.relations);

    if (!(className in dataSource.models)) {

        // store class in model pool
        dataSource.models[className] = Slave;
        dataSource.definitions[className] = new ModelDefinition(dataSource, md.name, md.properties, md.settings);

        if ((!dataSource.isTransaction) && dataSource.connector && dataSource.connector.define) {
            dataSource.connector.define({
                model:      Slave,
                properties: md.properties,
                settings:   md.settings
            });
        }

    }

    return Slave;
};

/**
 *
 * @returns {EventEmitter}
 * @private
 */
DataSource.prototype.transaction = function() {
    var dataSource = this;
    var transaction = new EventEmitter();

    for (var p in dataSource) {
        transaction[p] = dataSource[p];
    }

    transaction.isTransaction = true;
    transaction.origin = dataSource;
    transaction.name = dataSource.name;
    transaction.settings = dataSource.settings;
    transaction.connected = false;
    transaction.connecting = false;
    transaction.connector = dataSource.connector.transaction();

    // create blank models pool
    transaction.models = {};
    transaction.definitions = {};

    for (var i in dataSource.models) {
        dataSource.copyModel.call(transaction, dataSource.models[i]);
    }

    transaction.exec = function(cb) {
        transaction.connector.exec(cb);
    };

    return transaction;
};

/**
 * Enable a data source operation to be remote.
 * @param {String} operation The operation name
 */

DataSource.prototype.enableRemote = function (operation) {
  var op = this.getOperation(operation);
  if(op) {
    op.remoteEnabled = true;
  } else {
    throw new Error(operation + ' is not provided by the attached connector');
  }
}

/**
 * Disable a data source operation to be remote.
 * @param {String} operation The operation name
 */

DataSource.prototype.disableRemote = function (operation) {
  var op = this.getOperation(operation);
  if(op) {
    op.remoteEnabled = false;
  } else {
    throw new Error(operation + ' is not provided by the attached connector');
  }
}

/**
 * Get an operation's metadata.
 * @param {String} operation The operation name
 */

DataSource.prototype.getOperation = function (operation) {
  var ops = this.operations();
  var opKeys = Object.keys(ops);
  
  for(var i = 0; i < opKeys.length; i++) {
    var op = ops[opKeys[i]];
    
    if(op.name === operation) {
      return op;
    }
  }
}

/**
 * Get all operations.
 */
DataSource.prototype.operations = function () {
  return this._operations;
}

/**
 * Define an operation to the data source
 * @param {String} name The operation name
 * @param {Object} options The options
 * @param [Function} fn The function
 */
DataSource.prototype.defineOperation = function (name, options, fn) {
  options.fn = fn;
  options.name = name;
  this._operations[name] = options;
};

/**
 * Check if the backend is a relational DB
 * @returns {Boolean}
 */
DataSource.prototype.isRelational = function() {
    return this.connector && this.connector.relational;
};

/**
 * Check if the data source is ready
 * @param obj
 * @param args
 * @returns {boolean}
 */
DataSource.prototype.ready = function(obj, args) {
    var self = this;
    if (this.connected) {
        // Connected
        return false;
    }

    var method = args.callee;
    // Set up a callback after the connection is established to continue the method call

    var onConnected = null, onError = null;
    onConnected = function () {
        // Remove the error handler
        self.removeListener('error', onError);
        method.apply(obj, [].slice.call(args));
    };
    onError = function (err) {
        // Remove the connected listener
        self.removeListener('connected', onConnected);
        var params = [].slice.call(args);
        var cb = params.pop();
        if(typeof cb === 'function') {
            cb(err);
        }
    };
    this.once('connected', onConnected);
    this.once('error', onError);
    if (!this.connecting) {
        this.connect();
    }
    return true;
};


/**
 * Define a hidden property
 * @param {Object} obj The property owner
 * @param {String} key The property name
 * @param {Mixed} value The default value
 */
function hiddenProperty(obj, key, value) {
    Object.defineProperty(obj, key, {
        writable: false,
        enumerable: false,
        configurable: false,
        value: value
    });
}

/**
 * Define readonly property on object
 *
 * @param {Object} obj The property owner
 * @param {String} key The property name
 * @param {Mixed} value The default value
 */
function defineReadonlyProp(obj, key, value) {
    Object.defineProperty(obj, key, {
        writable: false,
        enumerable: true,
        configurable: true,
        value: value
    });
}

