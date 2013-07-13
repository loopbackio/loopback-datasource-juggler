/**
 * Module dependencies
 */
var ModelBuilder = require('./model-builder.js').ModelBuilder;
var jutil = require('./jutil');
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

/**
 * Helpers
 */
var slice = Array.prototype.slice;

/**
 * DataSource - adapter-specific classes factory.
 *
 * All classes in single schema shares same adapter type and
 * one database connection
 *
 * @param name - type of schema adapter (mysql, mongoose, sequelize, redis)
 * @param settings - any database-specific settings which we need to
 * establish connection (of course it depends on specific adapter)
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
 * var schema = new DataSource('mysql', { database: 'myapp_test' });
 * schema.define(...);
 * schema.on('connected', function () {
 *     // work with database
 * });
 * ```
 */
function DataSource(name, settings) {
    if (!(this instanceof DataSource)) {
        return new DataSource(name, settings);
    }
    ModelBuilder.call(this, arguments);

    // operation metadata
    // Initialize it before calling setup as the adapter might register operations
    this._operations = {};

    this.setup(name, settings);
    
    // connector
    var connector = this.connector();
    
    // DataAccessObject - connector defined or supply the default
    this.DataAccessObject = (connector && connector.DataAccessObject) ? connector.DataAccessObject : this.constructor.DataAccessObject;
    this.DataAccessObject.call(this, arguments);
    

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
};

util.inherits(DataSource, ModelBuilder);

// allow child classes to supply a data access object
DataSource.DataAccessObject = DataAccessObject;

// Copy over statics
for (var m in ModelBuilder) {
    if (!DataSource.hasOwnProperty(m) && 'super_' !== m) {
        DataSource[m] = ModelBuilder[m];
    }
}

DataSource.prototype.setup = function(name, settings) {
    var schema = this;
    var adapter;

    // support single settings object
    if(name && typeof name === 'object') {
      if(!name.initialize) {
        settings = name;
        name = undefined;
      }
    }
    
    if(typeof settings === 'object') {
      if(settings.initialize) {
        adapter = settings;
      } else if(settings.connector) {
        adapter = settings.connector;
      } else if(settings.adapter) {
        adapter = settings.adapter;
      }
    }
    
    // just save everything we get
    this.name = name;
    this.settings = settings;

    // Disconnected by default
    this.connected = false;
    this.connecting = false;

    if (name && !adapter) {
        // and initialize schema using adapter
        // this is only one initialization entry point of adapter
        // this module should define `adapter` member of `this` (schema)
        if (typeof name === 'object') {
            adapter = name;
            this.name = adapter.name;
        } else if (name.match(/^\//)) {
            // try absolute path
            adapter = require(name);
        } else if (existsSync(__dirname + '/adapters/' + name + '.js')) {
            // try built-in adapter
            adapter = require('./adapters/' + name);
        } else {
            // try foreign adapter
            try {
                adapter = require('jugglingdb-' + name);
            } catch (e) {
                return console.log('\nWARNING: JugglingDB adapter "' + name + '" is not installed,\nso your models would not work, to fix run:\n\n    npm install jugglingdb-' + name, '\n');
            }
        }
    }

    if (adapter) {
        var postInit = function postInit() {

            // we have an adaper now?
            if (!this.adapter) {
                throw new Error('Adapter is not defined correctly: it should create `adapter` member of schema');
            }

            this.adapter.log = function (query, start) {
                schema.log(query, start);
            };

            this.adapter.logger = function (query) {
                var t1 = Date.now();
                var log = this.log;
                return function (q) {
                    log(q || query, t1);
                };
            };

            this.connected = true;
            this.emit('connected');

        }.bind(this);

        if ('function' === typeof adapter.initialize) {
            // Call the async initialize method
            adapter.initialize(this, postInit);
        } else if('function' === typeof adapter) {
            // Use the adapter constructor directly
            this.adapter = new adapter(this.settings);
            postInit();
        }
    }

    schema.connect = function(cb) {
        var schema = this;
        if(schema.connected || schema.connecting) {
            process.nextTick(function() {
                cb && cb();
            });
            return;
        }
        schema.connecting = true;
        if (schema.adapter.connect) {
            schema.adapter.connect(function(err, result) {
                if (!err) {
                    schema.connected = true;
                    schema.connecting = false;
                    schema.emit('connected');
                }
                cb && cb(err, result);
            });
        } else {
            process.nextTick(function() {
                cb && cb();
            });
        }
    };
}

/**
 * Get the connector.
 */

DataSource.prototype.connector = function () {
  // alias for adapter compatibility
  return this.adapter;
};

/**
 * Define class
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
 * var User = schema.define('User', {
 *     email: String,
 *     password: String,
 *     birthDate: Date,
 *     activated: Boolean
 * });
 * ```
 * @example more advanced case
 * ```
 * var User = schema.define('User', {
 *     email: { type: String, limit: 150, index: true },
 *     password: { type: String, limit: 50 },
 *     birthDate: Date,
 *     registrationDate: {type: Date, default: function () { return new Date }},
 *     activated: { type: Boolean, default: false }
 * });
 * ```
 */
 
DataSource.prototype.define = function defineClass(className, properties, settings) {
    var args = slice.call(arguments);

    if (!className) throw new Error('Class name required');
    if (args.length == 1) properties = {}, args.push(properties);
    if (args.length == 2) settings   = {}, args.push(settings);

    properties = properties || {};
    settings = settings || {};

    var NewClass = ModelBuilder.prototype.define.call(this, className, properties, settings);

    // add data access objects
    this.mixin(NewClass);

    if(this.adapter && this.adapter.define) {
        // pass control to adapter
        this.adapter.define({
            model: NewClass,
            properties: properties,
            settings: settings
        });
    }

    return NewClass;
};

// alias createModel
DataSource.prototype.createModel = DataSource.prototype.define;

/**
 * Mixin DataAccessObject methods.
 */

DataSource.prototype.mixin = function (ModelCtor) {
  var ops = this.operations();
  var self = this;
  var DAO = this.DataAccessObject;
  
  // mixin DAO
  jutil.mixin(ModelCtor, DAO);
  
  // decorate operations as alias functions
  Object.keys(ops).forEach(function (name) {
    var op = ops[name];
    var fn = op.scope[op.fnName];
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
          ].indexOf(key)
        })
        .forEach(function (key) {
          if(typeof op[key] !== 'undefined') {
            op.scope[op.fnName][key] = op[key];
          }
        });
    }
  });
}

/**
 * Attach an existing model to a data source.
 */

DataSource.prototype.attach = function (ModelCtor) {
  var properties = ModelCtor.schema.definitions[ModelCtor.modelName].properties;
  var settings = ModelCtor.schema.definitions[ModelCtor.modelName].settings;
  var className = ModelCtor.modelName;

  this.mixin(ModelCtor);

  if(this.adapter && this.adapter.define) {
    // pass control to adapter
    this.adapter.define({
        model: ModelCtor,
        properties: properties,
        settings: settings
    });
  }
  
  // redefine the schema
  hiddenProperty(ModelCtor, 'schema', this);
  ModelCtor.dataSource = this;
  
  // add to def
  this.definitions[className] = {
      properties: properties,
      settings: settings
  };
  
  this.models[className] = ModelCtor;
  
  return this;
}

/**
 * Define single property named `prop` on `model`
 *
 * @param {String} model - name of model
 * @param {String} prop - name of propery
 * @param {Object} params - property settings
 */
DataSource.prototype.defineProperty = function (model, prop, params) {
    ModelBuilder.prototype.defineProperty.call(this, model, prop, params);

    if (this.adapter.defineProperty) {
        this.adapter.defineProperty(model, prop, params);
    }
};

/**
 * Drop each model table and re-create.
 * This method make sense only for sql adapters.
 *
 * @warning All data will be lost! Use autoupdate if you need your data.
 */
DataSource.prototype.automigrate = function (cb) {
    this.freeze();
    if (this.adapter.automigrate) {
        this.adapter.automigrate(cb);
    } else if (cb) {
        cb();
    }
};

/**
 * Update existing database tables.
 * This method make sense only for sql adapters.
 */
DataSource.prototype.autoupdate = function (cb) {
    this.freeze();
    if (this.adapter.autoupdate) {
        this.adapter.autoupdate(cb);
    } else if (cb) {
        cb();
    }
};

/**
 * Discover existing database tables.
 * This method returns an array of model objects, including {type, name, onwer}
 * 
 * @param options An object that contains the following settings:
 * all: true - Discovering all models, false - Discovering the models owned by the current user 
 * views: true - Including views, false - only tables
 * limit: The page size
 * offset: The starting index
 */
DataSource.prototype.discoverModelDefinitions = function (options, cb) {
    this.freeze();
    if (this.adapter.discoverModelDefinitions) {
        this.adapter.discoverModelDefinitions(options, cb);
    } else if (cb) {
        cb();
    }
};


DataSource.prototype.discoverModelDefinitionsSync = function (options) {
    this.freeze();
    if (this.adapter.discoverModelDefinitionsSync) {
        return this.adapter.discoverModelDefinitionsSync(options);
    }
    return null;
};

/**
 * Discover properties for a given model.
 *  The owner
 * @param table The table/view name
 * @param cb Callback
 * The method return an array of properties, including {owner, tableName, columnName, dataType, dataLength, nullable}
 */
DataSource.prototype.discoverModelProperties = function (table, options, cb) {
  this.freeze();
  if (this.adapter.discoverModelProperties) {
      this.adapter.discoverModelProperties(table, options, cb);
  } else if (cb) {
      cb();
  }
};

DataSource.prototype.discoverModelPropertiesSync = function (modelName, options) {
    this.freeze();
    if (this.adapter.discoverModelPropertiesSync) {
        return this.adapter.discoverModelPropertiesSync(modelName, options);
    }
    return null;
};

/**
 * Discover primary keys for a given owner/modelName
 *
 * Each primary key column description has the following columns:
 * owner String => table schema (may be null)
 * tableName String => table name
 * columnName String => column name
 * keySeq Number => sequence number within primary key( a value of 1 represents the first column of the primary key, a value of 2 would represent the second column within the primary key).
 * pkName String => primary key name (may be null)
 *
 *  The owner, default to current user
 * @param modelName The table name
 * @param cb Callback
 */
DataSource.prototype.discoverPrimaryKeys= function(modelName, options, cb) {
    this.freeze();
    if (this.adapter.discoverPrimaryKeys) {
        this.adapter.discoverPrimaryKeys(modelName, options, cb);
    } else if (cb) {
        cb();
    }
}

DataSource.prototype.discoverPrimaryKeysSync= function(modelName, options) {
    this.freeze();
    if (this.adapter.discoverPrimaryKeysSync) {
        return this.adapter.discoverPrimaryKeysSync(modelName, options);
    }
    return null;
}

/**
 * Discover foreign keys for a given owner/modelName
 *
 * fkOwner String => foreign key table schema (may be null)
 * fkName String => foreign key name (may be null)
 * fkTableName String => foreign key table name
 * fkColumnName String => foreign key column name
 * keySeq short => sequence number within a foreign key( a value of 1 represents the first column of the foreign key, a value of 2 would represent the second column within the foreign key).
 * pkOwner String => primary key table schema being imported (may be null)
 * pkName String => primary key name (may be null)
 * pkTableName String => primary key table name being imported
 * pkColumnName String => primary key column name being imported

 *
 *
 * @param modelName
 * @param cb
 */
DataSource.prototype.discoverForeignKeys= function(modelName, options, cb) {
    this.freeze();
    if (this.adapter.discoverForeignKeys) {
        this.adapter.discoverForeignKeys(modelName, options, cb);
    } else if (cb) {
        cb();
    }
}

DataSource.prototype.discoverForeignKeysSync= function(modelName, options) {
    this.freeze();
    if (this.adapter.discoverForeignKeysSync) {
        return this.adapter.discoverForeignKeysSync(modelName, options);
    }
    return null;
}

/**
 * Retrieves a description of the foreign key columns that reference the given table's primary key columns (the foreign keys exported by a table).
 * They are ordered by fkTableOwner, fkTableName, and keySeq.
 *
 * fkOwner String => foreign key table schema (may be null)
 * fkName String => foreign key name (may be null)
 * fkTableName String => foreign key table name
 * fkColumnName String => foreign key column name
 * keySeq short => sequence number within a foreign key( a value of 1 represents the first column of the foreign key, a value of 2 would represent the second column within the foreign key).
 * pkOwner String => primary key table schema being imported (may be null)
 * pkName String => primary key name (may be null)
 * pkTableName String => primary key table name being imported
 * pkColumnName String => primary key column name being imported
 *
 *
 * @param modelName
 * @param cb
 */
DataSource.prototype.discoverExportedForeignKeys= function(modelName, options, cb) {
    this.freeze();
    if (this.adapter.discoverExportedForeignKeys) {
        this.adapter.discoverExportedForeignKeys(modelName, options, cb);
    } else if (cb) {
        cb();
    }
}

DataSource.prototype.discoverExportedForeignKeysSync= function(modelName, options) {
    this.freeze();
    if (this.adapter.discoverExportedForeignKeysSync) {
        return this.adapter.discoverExportedForeignKeysSync(modelName, options);
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
 * @param modelName
 * @param cb
 */
DataSource.prototype.discoverSchemas = function (modelName, options, cb) {
    options = options || {};

    if(!cb && 'function' === typeof options) {
        cb = options;
        options = {};
    }

    var self = this;
    var dataSourceName = this.name || this.adapter.name;

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

        schema.options[dataSourceName] = {
            schema: columns[0].owner,
            table: modelName
        };

        columns.forEach(function (item) {
            var i = item;

            var propName = fromDBName(item.columnName, true);
            schema.properties[propName] = {
                type: item.type,
                required: (item.nullable === 'N'),
                length: item.dataLength
            };

            if (pks[item.columnName]) {
                schema.properties[propName].id = pks[item.columnName];
            }
            schema.properties[propName][dataSourceName] = {
                columnName: i.columnName,
                dataType: i.dataType,
                dataLength: i.dataLength,
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
}


/**
 * Discover schema from a given table/view
 *
 * @param modelName
 * @param cb
 */
DataSource.prototype.discoverSchemasSync = function (modelName, options) {
    var self = this;
    var dataSourceName = this.name || this.adapter.name;

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

    schema.options[dataSourceName] = {
        schema: columns.length > 0 && columns[0].owner,
        table: modelName
    };

    columns.forEach(function (item) {
        var i = item;

        var propName = fromDBName(item.columnName, true);
        schema.properties[propName] = {
            type: item.type,
            required: (item.nullable === 'N'),
            length: item.dataLength
        };

        if (pks[item.columnName]) {
            schema.properties[propName].id = pks[item.columnName];
        }
        schema.properties[propName][dataSourceName] = {
            columnName: i.columnName,
            dataType: i.dataType,
            dataLength: i.dataLength,
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
}

/**
 * Discover and build models from the given owner/modelName
 *
 * @param modelName
 * @param options
 * @param cb
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
}

/**
 * Discover and build models from the given owner/modelName synchronously
 *
 * @param modelName
 * @param options
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
}

/**
 * Check whether migrations needed
 * This method make sense only for sql adapters.
 */
DataSource.prototype.isActual = function (cb) {
    this.freeze();
    if (this.adapter.isActual) {
        this.adapter.isActual(cb);
    } else if (cb) {
        cb(null, true);
    }
};

/**
 * Log benchmarked message. Do not redefine this method, if you need to grab
 * chema logs, use `schema.on('log', ...)` emitter event
 *
 * @private used by adapters
 */
DataSource.prototype.log = function (sql, t) {
    this.emit('log', sql, t);
};

/**
 * Freeze schema. Behavior depends on adapter
 */
DataSource.prototype.freeze = function freeze() {
    if (this.adapter.freezeSchema) {
        this.adapter.freezeSchema();
    }
}

/**
 * Return table name for specified `modelName`
 * @param {String} modelName
 */
DataSource.prototype.tableName = function (modelName) {
    var settings = this.definitions[modelName].settings;
    if(settings[this.adapter.name]) {
        return settings[this.adapter.name].table || modelName;
    } else {
        return modelName;
    }
};

/**
 * Return column name for specified modelName and propertyName
 * @param modelName
 * @param propertyName
 * @returns {String} columnName
 */
DataSource.prototype.columnName = function (modelName, propertyName) {
    if(!propertyName) {
        return propertyName;
    }
    var property = this.definitions[modelName].properties[propertyName];
    if(property && property[this.adapter.name]) {
        return property[this.adapter.name].columnName || propertyName;
    } else {
        return propertyName;
    }
};

/**
 * Return column metadata for specified modelName and propertyName
 * @param modelName
 * @param propertyName
 * @returns {Object} column metadata
 */
DataSource.prototype.columnMetadata = function (modelName, propertyName) {
    if(!propertyName) {
        return propertyName;
    }
    var property = this.definitions[modelName].properties[propertyName];
    if(property && property[this.adapter.name]) {
        return property[this.adapter.name];
    } else {
        return null;
    }
};

/**
 * Return column names for specified modelName
 * @param modelName
 * @returns {[String]} column names
 */
DataSource.prototype.columnNames = function (modelName) {
    var props = this.definitions[modelName].properties;
    var cols = [];
    for(var p in props) {
        if(props[p][this.adapter.name]) {
            cols.push(props[p][this.adapter.name].columnName || p);
        } else {
            cols.push(p);
        }
    }
    return cols;
};

/**
 * Find the ID column name
 * @param modelName
 * @returns {String} columnName for ID
 */
DataSource.prototype.idColumnName = function(modelName) {
    return this.columnName(modelName, this.idName(modelName));
}

/**
 * Find the ID property name
 * @param modelName
 * @returns {String} property for ID
 */
DataSource.prototype.idName = function(modelName) {
    var props = this.definitions[modelName].properties;
    for(var key in props) {
        if(props[key].id) {
            return key;
        }
    }
    return null;
}

/**
 * Find the ID property names sorted by the index
 * @param modelName
 * @returns {[String]} property names for IDs
 */
DataSource.prototype.idNames = function (modelName) {
    var ids = [];
    var props = this.definitions[modelName].properties;
    for (var key in props) {
        if (props[key].id && props[key].id > 0) {
            ids.push({name: key, id: props[key].id});
        }
    }
    ids.sort(function (a, b) {
        return a.key - b.key;
    });
    var names = ids.map(function (id) {
        return id.name;
    });
    return names;
}


/**
 * Define foreign key
 * @param {String} className
 * @param {String} key - name of key field
 */
DataSource.prototype.defineForeignKey = function defineForeignKey(className, key, foreignClassName) {
    // quit if key already defined
    if (this.definitions[className].properties[key]) return;

    if (this.adapter.defineForeignKey) {
        var cb = function (err, keyType) {
            if (err) throw err;
            this.definitions[className].properties[key] = {type: keyType};
        }.bind(this);
        switch (this.adapter.defineForeignKey.length) {
            case 4:
                this.adapter.defineForeignKey(className, key, foreignClassName, cb);
            break;
            default:
            case 3:
                this.adapter.defineForeignKey(className, key, cb);
            break;
        }
    } else {
        this.definitions[className].properties[key] = {type: Number};
    }
    
    this.models[className].registerProperty(key);
};

/**
 * Close database connection
 */
DataSource.prototype.disconnect = function disconnect(cb) {
    var self = this;
    if (this.connected && (typeof this.adapter.disconnect === 'function')) {
        this.adapter.disconnect(function(err, result) {
            self.connected = false;
            cb && cb(err, result);
        });
    } else {
        process.nextTick(function() {
           cb && cb();
        });
    }
};

DataSource.prototype.copyModel = function copyModel(Master) {
    var schema = this;
    var className = Master.modelName;
    var md = Master.schema.definitions[className];
    var Slave = function SlaveModel() {
        Master.apply(this, [].slice.call(arguments));
        this.schema = schema;
    };

    util.inherits(Slave, Master);

    Slave.__proto__ = Master;

    hiddenProperty(Slave, 'schema', schema);
    hiddenProperty(Slave, 'modelName', className);
    hiddenProperty(Slave, 'relations', Master.relations);

    if (!(className in schema.models)) {

        // store class in model pool
        schema.models[className] = Slave;
        schema.definitions[className] = {
            properties: md.properties,
            settings: md.settings
        };

        if ((!schema.isTransaction) && schema.adapter && schema.adapter.define) {
            schema.adapter.define({
                model:      Slave,
                properties: md.properties,
                settings:   md.settings
            });
        }

    }

    return Slave;
};

DataSource.prototype.transaction = function() {
    var schema = this;
    var transaction = new EventEmitter;
    transaction.isTransaction = true;
    transaction.origin = schema;
    transaction.name = schema.name;
    transaction.settings = schema.settings;
    transaction.connected = false;
    transaction.connecting = false;
    transaction.adapter = schema.adapter.transaction();

    // create blank models pool
    transaction.models = {};
    transaction.definitions = {};

    for (var i in schema.models) {
        schema.copyModel.call(transaction, schema.models[i]);
    }

    transaction.connect = schema.connect;

    transaction.exec = function(cb) {
        transaction.adapter.exec(cb);
    };

    return transaction;
};

/**
 * Enable a data source operation remotely.
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
 * Disable a data source operation remotely.
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
 * Define an operation.
 */

DataSource.prototype.defineOperation = function (name, options, fn) {
  options.fn = fn;
  options.name = name;
  this._operations[name] = options;
}

DataSource.prototype.isRational = function() {
    return this.adapter && this.adapter.relational;
}

/**
 * Define hidden property
 */
function hiddenProperty(where, property, value) {
    Object.defineProperty(where, property, {
        writable: false,
        enumerable: false,
        configurable: false,
        value: value
    });
}

/**
 * Define readonly property on object
 *
 * @param {Object} obj
 * @param {String} key
 * @param {Mixed} value
 */
function defineReadonlyProp(obj, key, value) {
    Object.defineProperty(obj, key, {
        writable: false,
        enumerable: true,
        configurable: true,
        value: value
    });
}

