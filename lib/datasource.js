/**
 * Module dependencies
 */
var ADL = require('./adl.js').Schema;
var ModelBaseClass = require('./model.js');
var DataAccessObject = require('./dao.js');
var List = require('./list.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var path = require('path');
var fs = require('fs');

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
    ADL.call(this);
    this.setup(name, settings);
};

util.inherits(DataSource, ADL);

// Copy over statics
for (var m in ADL) {
    if (!DataSource.hasOwnProperty(m) && 'super_' !== m) {
        DataSource[m] = ADL[m];
    }
}

DataSource.prototype.setup = function(name, settings) {
    var schema = this;

    // just save everything we get
    this.name = name;
    this.settings = settings;

    // Disconnected by default
    this.connected = false;
    this.connecting = false;

    if (name) {
        // and initialize schema using adapter
        // this is only one initialization entry point of adapter
        // this module should define `adapter` member of `this` (schema)
        var adapter;
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
        adapter.initialize(this, function () {

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

        }.bind(this));
    }

    schema.connect = function(cb) {
        var schema = this;
        if(schema.connected) {
            if (cb) {
                process.nextTick(cb);
            }
            return;
        }
        schema.connecting = true;
        if (schema.adapter.connect) {
            schema.adapter.connect(function(err) {
                if (!err) {
                    schema.connected = true;
                    schema.connecting = false;
                    schema.emit('connected');
                }
                if (cb) {
                    cb(err);
                }
            });
        } else {
            if (cb) {
                process.nextTick(cb);
            }
        }
    };
}

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

    var NewClass = ADL.prototype.define.call(this, className, properties, settings);

    // inherit DataAccessObject methods
    for (var m in DataAccessObject) {
        NewClass[m] = DataAccessObject[m];
    }
    for (var n in DataAccessObject.prototype) {
        NewClass.prototype[n] = DataAccessObject.prototype[n];
    }

    if(this.adapter) {
        // pass control to adapter
        this.adapter.define({
            model: NewClass,
            properties: properties,
            settings: settings
        });
    }

    return NewClass;

};

/**
 * Define single property named `prop` on `model`
 *
 * @param {String} model - name of model
 * @param {String} prop - name of propery
 * @param {Object} params - property settings
 */
DataSource.prototype.defineProperty = function (model, prop, params) {
    ADL.prototype.defineProperty.call(this, model, prop, params);

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
DataSource.prototype.discoverModels = function (options, cb) {
    this.freeze();
    if (this.adapter.discoverModels) {
        this.adapter.discoverModels(options, cb);
    } else if (cb) {
        cb();
    }
};

/**
 * Discover properties for a given model.
 * @param owner The owner
 * @param table The table/view name
 * @param cb Callback
 * The method return an array of properties, including {owner, tableName, columnName, dataType, dataLength, nullable}
 */
DataSource.prototype.discoverModelProperties = function (owner, table, cb) {
  this.freeze();
  if (this.adapter.discoverModelProperties) {
      this.adapter.discoverModelProperties(owner, table, cb);
  } else if (cb) {
      cb();
  }
};

/**
 * Discover primary keys for a given owner/table
 *
 * Each primary key column description has the following columns:
 * owner String => table schema (may be null)
 * tableName String => table name
 * columnName String => column name
 * keySeq Number => sequence number within primary key( a value of 1 represents the first column of the primary key, a value of 2 would represent the second column within the primary key).
 * pkName String => primary key name (may be null)
 *
 * @param owner The owner, default to current user
 * @param table The table name
 * @param cb Callback
 */
DataSource.prototype.discoverPrimaryKeys= function(owner, table, cb) {
    this.freeze();
    if (this.adapter.discoverPrimaryKeys) {
        this.adapter.discoverPrimaryKeys(owner, table, cb);
    } else if (cb) {
        cb();
    }
}

/**
 * Discover foreign keys for a given owner/table
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
 * @param owner
 * @param table
 * @param cb
 */
DataSource.prototype.discoverForeignKeys= function(owner, table, cb) {
    this.freeze();
    if (this.adapter.discoverForeignKeys) {
        this.adapter.discoverForeignKeys(owner, table, cb);
    } else if (cb) {
        cb();
    }
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
 * Discover ADL schema from a given table/view
 * @param owner
 * @param table
 * @param cb
 */
DataSource.prototype.discoverSchema = function(owner, table, cb) {
    var dataSourceName = this.name;
    this.discoverModelProperties(owner, table, function (err, columns) {
        if (err) {
            cb && cb(err);
            return;
        }
        if(!columns) {
            cb && cb();
            return;
        }
        var schema = {
            name: fromDBName(table, false),
            options: {
            },
            properties: {
            }
        };

        schema.options[dataSourceName] = {
            schema: owner,
            table: table
        };
        columns.forEach(function (item) {
            var i = item;
            var propName = fromDBName(item.columnName, true);
            schema.properties[propName] =
            {
                type: item.type,
                required: (item.nullable === 'N'),
                length: item.dataLength
            };
            schema.properties[propName][dataSourceName] = {
                columnName: i.columnName,
                dataType: i.dataType,
                nullable: i.nullable
            };
        });

        cb && cb(null, schema);
    });
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
    return this.definitions[modelName].settings.table = this.definitions[modelName].settings.table || modelName
};

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
    if (typeof this.adapter.disconnect === 'function') {
        this.connected = false;
        this.adapter.disconnect(cb);
    } else if (cb) {
        cb();
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

        if (!schema.isTransaction) {
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

