/*!
 * Module dependencies
 */
var ModelBuilder = require('./model-builder.js').ModelBuilder;
var ModelDefinition = require('./model-definition.js');
var jutil = require('./jutil');
var utils = require('./utils');
var ModelBaseClass = require('./model.js');
var DataAccessObject = require('./dao.js');
var defineScope = require('./scope.js').defineScope;
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var assert = require('assert');
var async = require('async');

if (process.env.DEBUG === 'loopback') {
  // For back-compatibility
  process.env.DEBUG = 'loopback:*';
}
var debug = require('debug')('loopback:datasource');

/*!
 * Export public API
 */
exports.DataSource = DataSource;

/*!
 * Helpers
 */
var slice = Array.prototype.slice;

/**
 * LoopBack models can manipulate data via the DataSource object.
 * Attaching a `DataSource` to a `Model` adds instance methods and static methods to the `Model`;
 * some of the added methods may be remote methods.
 *
 * Define a data source for persisting models.
 * Typically, you create a DataSource by calling createDataSource() on the LoopBack object; for example:
 * ```js
 * var oracle = loopback.createDataSource({
 *   connector: 'oracle',
 *   host: '111.22.333.44',
 *   database: 'MYDB',
 *   username: 'username',
 *   password: 'password'
 * });
 * ```
 *
 * All classes in single dataSource share same the connector type and
 * one database connection.  The `settings` argument is an object that can have the following properties:
 * - host
 * - port
 * - username
 * - password
 * - database
 * - debug (Boolean, default is false)
 *
 * @desc For example, the following creates a DataSource, and waits for a connection callback.
 * ```
 * var dataSource = new DataSource('mysql', { database: 'myapp_test' });
 * dataSource.define(...);
 * dataSource.on('connected', function () {
 *     // work with database
 * });
 * ```
 * @class Define new DataSource
 * @param {String} name Type of dataSource connector (mysql, mongoose, oracle, redis)
 * @param {Object} settings Database-specific settings to establish connection (settings depend on specific connector).  See above.
 */
function DataSource(name, settings, modelBuilder) {
  if (!(this instanceof DataSource)) {
    return new DataSource(name, settings);
  }

  // Check if the settings object is passed as the first argument
  if (typeof name === 'object' && settings === undefined) {
    settings = name;
    name = undefined;
  }

  // Check if the first argument is a URL
  if (typeof name === 'string' && name.indexOf('://') !== -1) {
    name = utils.parseSettings(name);
  }

  // Check if the settings is in the form of URL string
  if (typeof settings === 'string' && settings.indexOf('://') !== -1) {
    settings = utils.parseSettings(settings);
  }

  this.modelBuilder = modelBuilder || new ModelBuilder();
  this.models = this.modelBuilder.models;
  this.definitions = this.modelBuilder.definitions;

  // operation metadata
  // Initialize it before calling setup as the connector might register operations
  this._operations = {};

  this.setup(name, settings);

  this._setupConnector();

  // connector
  var connector = this.connector;

  // DataAccessObject - connector defined or supply the default
  var dao = (connector && connector.DataAccessObject) || this.constructor.DataAccessObject;
  this.DataAccessObject = function () {
  };

  // define DataAccessObject methods
  Object.keys(dao).forEach(function (name) {
    var fn = dao[name];
    this.DataAccessObject[name] = fn;

    if (typeof fn === 'function') {
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
  Object.keys(dao.prototype).forEach(function (name) {
    var fn = dao.prototype[name];
    this.DataAccessObject.prototype[name] = fn;
    if (typeof fn === 'function') {
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

util.inherits(DataSource, EventEmitter);

// allow child classes to supply a data access object
DataSource.DataAccessObject = DataAccessObject;

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

// List possible connector module names
function connectorModuleNames(name) {
  var names = []; // Check the name as is
  if (!name.match(/^\//)) {
    names.push('./connectors/' + name); // Check built-in connectors
    if (name.indexOf('loopback-connector-') !== 0) {
      names.push('loopback-connector-' + name); // Try loopback-connector-<name>
    }
  }
  // Only try the short name if the connector is not from StrongLoop
  if(['mongodb', 'oracle', 'mysql', 'postgresql', 'mssql', 'rest', 'soap']
    .indexOf(name) === -1) {
    names.push(name);
  }
  return names;
}

// testable with DI
function tryModules(names, loader) {
  var mod;
  loader = loader || require;
  for (var m = 0; m < names.length; m++) {
    try {
      mod = loader(names[m]);
    } catch (e) {
      /* ignore */
    }
    if (mod) {
      break;
    }
  }
  return mod;
}

/*!
 * Resolve a connector by name
 * @param name The connector name
 * @returns {*}
 * @private
 */
DataSource._resolveConnector = function (name, loader) {
  var names = connectorModuleNames(name);
  var connector = tryModules(names, loader);
  var error = null;
  if (!connector) {
    error = '\nWARNING: LoopBack connector "' + name
      + '" is not installed at any of the locations ' + names
      + '. To fix, run:\n\n    npm install '
      + name + '\n';
  }
  return {
    connector: connector,
    error: error
  };
};

/**
 * Set up the data source
 * @param {String} name The name
 * @param {Object} settings The settings
 * @returns {*}
 * @private
 */
DataSource.prototype.setup = function (name, settings) {
  var dataSource = this;
  var connector;

  // support single settings object
  if (name && typeof name === 'object' && !settings) {
    settings = name;
    name = undefined;
  }

  if (typeof settings === 'object') {
    if (settings.initialize) {
      connector = settings;
    } else if (settings.connector) {
      connector = settings.connector;
    } else if (settings.adapter) {
      connector = settings.adapter;
    }
  }

  // just save everything we get
  this.settings = settings || {};

  this.settings.debug = this.settings.debug || debug.enabled;

  if(this.settings.debug) {
    debug('Settings: %j', this.settings);
  }

  // Disconnected by default
  this.connected = false;
  this.connecting = false;

  if (typeof connector === 'string') {
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
    } else {
      // The connector has not been resolved
      var result = DataSource._resolveConnector(name);
      connector = result.connector;
      if (!connector) {
        console.error(result.error);
        return;
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
      if (this.connected) {
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
    } else if ('function' === typeof connector) {
      // Use the connector constructor directly
      this.connector = new connector(this.settings);
      postInit();
    }
  }

  dataSource.connect = function (cb) {
    var dataSource = this;
    if (dataSource.connected || dataSource.connecting) {
      process.nextTick(function () {
        cb && cb();
      });
      return;
    }
    dataSource.connecting = true;
    if (dataSource.connector.connect) {
      dataSource.connector.connect(function (err, result) {
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
      process.nextTick(function () {
        dataSource.connected = true;
        dataSource.connecting = false;
        dataSource.emit('connected');
        cb && cb();
      });
    }
  };
};

function isModelClass(cls) {
  if (!cls) {
    return false;
  }
  return cls.prototype instanceof ModelBaseClass;
}

DataSource.relationTypes = ['belongsTo', 'hasMany', 'hasAndBelongsToMany'];

function isModelDataSourceAttached(model) {
  return model && (!model.settings.unresolved) && (model.dataSource instanceof DataSource);
}

/*!
 * Define scopes for the model class from the scopes object
 * @param modelClass
 * @param scopes
 */
DataSource.prototype.defineScopes = function (modelClass, scopes) {
  if(scopes) {
    for(var s in scopes) {
      defineScope(modelClass, modelClass, s, scopes[s]);
    }
  }
};

/*!
 * Define relations for the model class from the relations object
 * @param modelClass
 * @param relations
 */
DataSource.prototype.defineRelations = function (modelClass, relations) {

  // Create a function for the closure in the loop
  var createListener = function (name, relation, targetModel, throughModel) {
    if (!isModelDataSourceAttached(targetModel)) {
      targetModel.once('dataSourceAttached', function (model) {
        // Check if the through model doesn't exist or resolved
        if (!throughModel || isModelDataSourceAttached(throughModel)) {
          // The target model is resolved
          var params = {
            foreignKey: relation.foreignKey,
            as: name,
            model: model
          };
          if (throughModel) {
            params.through = throughModel;
          }
          modelClass[relation.type].call(modelClass, name, params);
        }
      });

    }
    if (throughModel && !isModelDataSourceAttached(throughModel)) {
      // Set up a listener to the through model
      throughModel.once('dataSourceAttached', function (model) {
        if (isModelDataSourceAttached(targetModel)) {
          // The target model is resolved
          var params = {
            foreignKey: relation.foreignKey,
            as: name,
            model: targetModel,
            through: model
          };
          modelClass[relation.type].call(modelClass, name, params);
        }
      });
    }
  };

  // Set up the relations
  if (relations) {
    for (var rn in relations) {
      var r = relations[rn];
      assert(DataSource.relationTypes.indexOf(r.type) !== -1, "Invalid relation type: " + r.type);
      var targetModel = isModelClass(r.model) ? r.model : this.getModel(r.model, true);
      var throughModel = null;
      if (r.through) {
        throughModel = isModelClass(r.through) ? r.through : this.getModel(r.through, true);
      }
      if (!isModelDataSourceAttached(targetModel) || (throughModel && !isModelDataSourceAttached(throughModel))) {
        // Create a listener to defer the relation set up
        createListener(rn, r, targetModel, throughModel);
      } else {
        // The target model is resolved
        var params = {
          foreignKey: r.foreignKey,
          as: rn,
          model: targetModel
        };
        if (throughModel) {
          params.through = throughModel;
        }
        modelClass[r.type].call(modelClass, rn, params);
      }
    }
  }
};

/*!
 * Set up the data access functions from the data source
 * @param {Model} modelClass The model class
 * @param {Object} settings The settings object
 */
DataSource.prototype.setupDataAccess = function (modelClass, settings) {
  if (this.connector) {
    // Check if the id property should be generated
    var idName = modelClass.definition.idName();
    var idProp = modelClass.definition.rawProperties[idName];
    if(idProp && idProp.generated && this.connector.getDefaultIdType) {
      // Set the default id type from connector's ability
      var idType = this.connector.getDefaultIdType() || String;
      idProp.type = idType;
      modelClass.definition.properties[idName].type = idType;
    }
    if (this.connector.define) {
      // pass control to connector
      this.connector.define({
        model: modelClass,
        properties: modelClass.definition.properties,
        settings: settings
      });
    }
  }

  // add data access objects
  this.mixin(modelClass);

  var relations = settings.relationships || settings.relations;
  this.defineRelations(modelClass, relations);

  var scopes = settings.scopes || {};
  this.defineScopes(modelClass, scopes);

};

/**
 * Define a model class.  Returns newly created model object.
 * The first (String) argument specifying the model name is required.
 * You can provide one or two JSON object arguments, to provide configuration options.
 * See [Model definition reference](http://docs.strongloop.com/display/DOC/Model+definition+reference) for details.
 * 
 * Simple example:
 * ```
 * var User = dataSource.createModel('User', {
 *     email: String,
 *     password: String,
 *     birthDate: Date,
 *     activated: Boolean
 * });
 * ```
 * More advanced example
 * ```
 * var User = dataSource.createModel('User', {
 *     email: { type: String, limit: 150, index: true },
 *     password: { type: String, limit: 50 },
 *     birthDate: Date,
 *     registrationDate: {type: Date, default: function () { return new Date }},
 *     activated: { type: Boolean, default: false }
 * });
 * ```
 * You can also define an ACL when you create a new data source with the `DataSource.create()` method. For example:
 * 
 * ```js
 * var Customer = ds.createModel('Customer', {
 *       name: {
 *         type: String,
 *         acls: [
 *           {principalType: ACL.USER, principalId: 'u001', accessType: ACL.WRITE, permission: ACL.DENY},
 *           {principalType: ACL.USER, principalId: 'u001', accessType: ACL.ALL, permission: ACL.ALLOW}
 *         ]
 *       }
 *     }, {
 *       acls: [
 *         {principalType: ACL.USER, principalId: 'u001', accessType: ACL.ALL, permission: ACL.ALLOW}
 *       ]
 *     });
 * ```
 *
 * @param {String} className Name of the model to create.
 * @param {Object} properties Hash of model properties in format `{property: Type, property2: Type2, ...}` or `{property: {type: Type}, property2: {type: Type2}, ...}`
 * @options {Object} properties Other configuration options.  This corresponds to the options key in the config object.
 *
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
    settings = {};
    args.push(settings);
  }

  properties = properties || {};
  settings = settings || {};

  if (this.isRelational()) {
    // Set the strict mode to be true for relational DBs by default
    if (settings.strict === undefined || settings.strict === null) {
      settings.strict = true;
    }
    if (settings.strict === false) {
      settings.strict = 'throw';
    }
  }

  var modelClass = this.modelBuilder.define(className, properties, settings);
  modelClass.dataSource = this;

  if (settings.unresolved) {
    return modelClass;
  }

  this.setupDataAccess(modelClass, settings);
  modelClass.emit('dataSourceAttached', modelClass);

  return modelClass;
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
  jutil.mixin(ModelCtor, DAO, {proxyFunctions: true, override: true});

  // decorate operations as alias functions
  Object.keys(ops).forEach(function (name) {
    var op = ops[name];
    var scope;

    if (op.enabled) {
      scope = op.prototype ? ModelCtor.prototype : ModelCtor;
      // var sfn = scope[name] = function () {
      //   op.scope[op.fnName].apply(self, arguments);
      // }
      Object.keys(op)
        .filter(function (key) {
          // filter out the following keys
          return ~[
            'scope',
            'fnName',
            'prototype'
          ].indexOf(key);
        })
        .forEach(function (key) {
          if (typeof op[key] !== 'undefined') {
            op.scope[op.fnName][key] = op[key];
          }
        });
    }
  });
};

/**
 * See ModelBuilder.getModel
 */
DataSource.prototype.getModel = function (name, forceCreate) {
  return this.modelBuilder.getModel(name, forceCreate);
};

/**
 * See ModelBuilder.getModelDefinition
 */
DataSource.prototype.getModelDefinition = function (name) {
  return this.modelBuilder.getModelDefinition(name);
};

/**
 * Get the data source types
 * @returns {String[]} The data source type, such as ['db', 'nosql', 'mongodb'],
 * ['rest'], or ['db', 'rdbms', 'mysql']
 */
DataSource.prototype.getTypes = function () {
  var types = this.connector && this.connector.getTypes() || [];
  if (typeof types === 'string') {
    types = types.split(/[\s,\/]+/);
  }
  return types;
};

/**
 * Check the data source supports the specified types.
 * @param {String} types Type name or an array of type names.  Can also be array of Strings.
 * @returns {Boolean} true if all types are supported by the data source
 */
DataSource.prototype.supportTypes = function (types) {
  var supportedTypes = this.getTypes();
  if (Array.isArray(types)) {
    // Check each of the types
    for (var i = 0; i < types.length; i++) {
      if (supportedTypes.indexOf(types[i]) === -1) {
        // Not supported
        return false;
      }
    }
    return true;
  } else {
    // The types is a string
    return supportedTypes.indexOf(types) !== -1;
  }
};

/**
 * Attach an existing model to a data source.
 *
 * @param {Function} modelClass The model constructor
 */

DataSource.prototype.attach = function (modelClass) {
  if (modelClass.dataSource === this) {
    // Already attached to the data source
    return modelClass;
  }

  if (modelClass.modelBuilder !== this.modelBuilder) {
    this.modelBuilder.definitions[modelClass.modelName] = modelClass.definition;
    this.modelBuilder.models[modelClass.modelName] = modelClass;
    // reset the modelBuilder
    modelClass.modelBuilder = this.modelBuilder;
  }

  // redefine the dataSource
  modelClass.dataSource = this;

  this.setupDataAccess(modelClass, modelClass.settings);
  modelClass.emit('dataSourceAttached', modelClass);
  return modelClass;

};

/**
 * Define single property named `prop` on `model`
 *
 * @param {String} model Name of model
 * @param {String} prop Name of property
 * @param {Object} params Property settings
 */
DataSource.prototype.defineProperty = function (model, prop, params) {
  this.modelBuilder.defineProperty(model, prop, params);

  var resolvedProp = this.getModelDefinition(model).properties[prop];
  if (this.connector && this.connector.defineProperty) {
    this.connector.defineProperty(model, prop, resolvedProp);
  }
};

/**
 * Drop each model table and re-create.
 * This method applies only to SQL connectors.
 *
 * @param {String} model Model to migrate.  If not present, apply to all models.  Can also be an array of Strings.
 * @param {Function} cb Callback function. Optional.
 *
 * WARNING: Calling this function will cause all data to be lost! Use autoupdate if you need to preserve data.
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
 * @param {String} model Model to migrate.  If not present, apply to all models.  Can also be an array of Strings.
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
 * @param {Object} options The options
 * @param {Function} Callback function.  Optional.
 * @options {Object} options Discovery options.
 *
 * Keys in options object:
 *
 * @property {Boolean} all If true, discover all models; if false, discover only models owned by the current user.
 * @property {Boolean} views If true, nclude views; if false, only tables.
 * @property {Number} limit Page size
 * @property {Number} offset Starting index
 *
 */
DataSource.prototype.discoverModelDefinitions = function (options, cb) {
  this.freeze();
  if (this.connector.discoverModelDefinitions) {
    this.connector.discoverModelDefinitions(options, cb);
  } else if (cb) {
    process.nextTick(cb);
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
 * property description:
 *
*| Key | Type | Description |
*|-----|------|-------------|
*|owner | String | Database owner or schema|
*|tableName | String | Table/view name|
*|columnName | String | Column name|
*|dataType | String | Data type|
*|dataLength | Number | Data length|
*|dataPrecision | Number | Numeric data precision|
*|dataScale |Number | Numeric data scale|
*|nullable |Boolean | If true, then the data can be null|
 *
 * Options:
 * - owner/schema The database owner/schema
 *
 * @param {String} modelName The table/view name
 * @param {Object} options The options
 * @param {Function} cb Callback function. Optional
 *
 */
DataSource.prototype.discoverModelProperties = function (modelName, options, cb) {
  this.freeze();
  if (this.connector.discoverModelProperties) {
    this.connector.discoverModelProperties(modelName, options, cb);
  } else if (cb) {
    process.nextTick(cb);
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
 * Discover primary keys for a given owner/modelName.
 *
 * Each primary key column description has the following columns:
 *
 * - owner {String} => table schema (may be null)
 * - tableName {String} => table name
 * - columnName {String} => column name
 * - keySeq {Number} => sequence number within primary key( a value of 1 represents the first column of the primary key, a value of 2 would represent the second column within the primary key).
 * - pkName {String} => primary key name (may be null)
 *
 * The owner defaults to current user.
 *
 * Options:
 * - owner/schema The database owner/schema
 *
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.discoverPrimaryKeys = function (modelName, options, cb) {
  this.freeze();
  if (this.connector.discoverPrimaryKeys) {
    this.connector.discoverPrimaryKeys(modelName, options, cb);
  } else if (cb) {
    process.nextTick(cb);
  }
};

/**
 * The synchronous version of discoverPrimaryKeys
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverPrimaryKeysSync = function (modelName, options) {
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
DataSource.prototype.discoverForeignKeys = function (modelName, options, cb) {
  this.freeze();
  if (this.connector.discoverForeignKeys) {
    this.connector.discoverForeignKeys(modelName, options, cb);
  } else if (cb) {
    process.nextTick(cb);
  }
};

/**
 * The synchronous version of discoverForeignKeys
 *
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverForeignKeysSync = function (modelName, options) {
  this.freeze();
  if (this.connector.discoverForeignKeysSync) {
    return this.connector.discoverForeignKeysSync(modelName, options);
  }
  return null;
};

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
DataSource.prototype.discoverExportedForeignKeys = function (modelName, options, cb) {
  this.freeze();
  if (this.connector.discoverExportedForeignKeys) {
    this.connector.discoverExportedForeignKeys(modelName, options, cb);
  } else if (cb) {
    process.nextTick(cb);
  }
};

/**
 * The synchronous version of discoverExportedForeignKeys
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverExportedForeignKeysSync = function (modelName, options) {
  this.freeze();
  if (this.connector.discoverExportedForeignKeysSync) {
    return this.connector.discoverExportedForeignKeysSync(modelName, options);
  }
  return null;
};

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
 * Discover one schema from the given model without following the relations.
**Example schema from oracle connector:**
 *
 * ```js
 *     {
 *       "name": "Product",
 *       "options": {
 *         "idInjection": false,
 *         "oracle": {
 *           "schema": "BLACKPOOL",
 *           "table": "PRODUCT"
 *         }
 *       },
 *       "properties": {
 *         "id": {
 *           "type": "String",
 *           "required": true,
 *           "length": 20,
 *           "id": 1,
 *           "oracle": {
 *             "columnName": "ID",
 *             "dataType": "VARCHAR2",
 *             "dataLength": 20,
 *             "nullable": "N"
 *           }
 *         },
 *         "name": {
 *           "type": "String",
 *           "required": false,
 *           "length": 64,
 *           "oracle": {
 *             "columnName": "NAME",
 *             "dataType": "VARCHAR2",
 *             "dataLength": 64,
 *             "nullable": "Y"
 *           }
 *         },
 * ...
 *         "fireModes": {
 *           "type": "String",
 *           "required": false,
 *           "length": 64,
 *           "oracle": {
 *             "columnName": "FIRE_MODES",
 *             "dataType": "VARCHAR2",
 *             "dataLength": 64,
 *             "nullable": "Y"
 *           }
 *         }
 *       }
 *     }
 * ```
 *
 * @param {String} modelName The model name
 * @param {Object} [options] The options
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.discoverSchema = function (modelName, options, cb) {
  options = options || {};

  if (!cb && 'function' === typeof options) {
    cb = options;
    options = {};
  }
  options.visited = {};
  options.relations = false;

  this.discoverSchemas(modelName, options, function (err, schemas) {
    if (err) {
      cb && cb(err, schemas);
      return;
    }
    for (var s in schemas) {
      cb && cb(null, schemas[s]);
      return;
    }
  });
};

/**
 * Discover schema from a given modelName/view
 *
 * `options`
 *
 *      {String} owner/schema - The database owner/schema name
 *      {Boolean} relations - If relations (primary key/foreign key) are navigated
 *      {Boolean} all - If all owners are included
 *      {Boolean} views - If views are included
 *
 * @param {String} modelName The model name
 * @param {Object} [options] The options
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.discoverSchemas = function (modelName, options, cb) {
  options = options || {};

  if (!cb && 'function' === typeof options) {
    cb = options;
    options = {};
  }

  var self = this;
  var schemaName = this.connector.name || this.name;

  var tasks = [
    this.discoverModelProperties.bind(this, modelName, options),
    this.discoverPrimaryKeys.bind(this, modelName, options) ];

  var followingRelations = options.associations || options.relations;
  if (followingRelations) {
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
      debug('Primary keys: ', pks);
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
      if (self.settings.debug) {
        debug('Adding schema for ' + schemaKey);
      }
      options.visited[schemaKey] = schema;
    }

    var otherTables = {};
    if (followingRelations) {
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
        debug('Foreign keys: ', fks);
      }

      schema.options.relations = {};
      foreignKeys.forEach(function (fk) {
        var propName = fromDBName(fk.pkTableName, true);
        schema.options.relations[propName] = {
          model: fromDBName(fk.pkTableName, false),
          type: 'belongsTo',
          foreignKey: fromDBName(fk.fkColumnName, true)
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
        if (self.settings.debug) {
          debug('Discovering related schema for ' + schemaKey);
        }
        var newOptions = {};
        for (var key in options) {
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
 *      {Boolean} relations - If relations (primary key/foreign key) are navigated
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
    debug('Primary keys: ', pks);
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
      debug('Adding schema for ' + schemaKey);
    }
    options.visited[schemaKey] = schema;
  }

  var otherTables = {};
  var followingRelations = options.associations || options.relations;
  if (followingRelations) {
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
      debug('Foreign keys: ', fks);
    }

    schema.options.relations = {};
    foreignKeys.forEach(function (fk) {
      var propName = fromDBName(fk.pkTableName, true);
      schema.options.relations[propName] = {
        model: fromDBName(fk.pkTableName, false),
        type: 'belongsTo',
        foreignKey: fromDBName(fk.fkColumnName, true)
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
        debug('Discovering related schema for ' + schemaKey);
      }
      var newOptions = {};
      for (var key in options) {
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
 *      {Boolean} relations - If relations (primary key/foreign key) are navigated
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

    var models = self.modelBuilder.buildModels(schemaList);
    // Now attach the models to the data source
    for (var m in models) {
      models[m].attachTo(self);
    }
    cb && cb(err, models);
  });
};

/**
 * Discover and build models from the given owner/modelName synchronously
 *
 * `options`
 *
 *      {String} owner/schema - The database owner/schema name
 *      {Boolean} relations - If relations (primary key/foreign key) are navigated
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

  var models = this.modelBuilder.buildModels(schemaList);
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
      process.nextTick(function () {
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
  debug(sql, t);
  this.emit('log', sql, t);
};

/**
 * Freeze dataSource. Behavior depends on connector
 */
DataSource.prototype.freeze = function freeze() {
  if(!this.connector) {
    throw new Error('The connector has not been initialized.');
  }
  if (this.connector.freezeDataSource) {
    this.connector.freezeDataSource();
  }
  if (this.connector.freezeSchema) {
    this.connector.freezeSchema();
  }
};

/**
 * Return table name for specified `modelName`
 * @param {String} modelName The model name
 */
DataSource.prototype.tableName = function (modelName) {
  return this.getModelDefinition(modelName).tableName(this.connector.name);
};

/**
 * Return column name for specified modelName and propertyName
 * @param {String} modelName The model name
 * @param propertyName The property name
 * @returns {String} columnName
 */
DataSource.prototype.columnName = function (modelName, propertyName) {
  return this.getModelDefinition(modelName).columnName(this.connector.name, propertyName);
};

/**
 * Return column metadata for specified modelName and propertyName
 * @param {String} modelName The model name
 * @param propertyName The property name
 * @returns {Object} column metadata
 */
DataSource.prototype.columnMetadata = function (modelName, propertyName) {
  return this.getModelDefinition(modelName).columnMetadata(this.connector.name, propertyName);
};

/**
 * Return column names for specified modelName
 * @param {String} modelName The model name
 * @returns {String[]} column names
 */
DataSource.prototype.columnNames = function (modelName) {
  return this.getModelDefinition(modelName).columnNames(this.connector.name);
};

/**
 * Find the ID column name
 * @param {String} modelName The model name
 * @returns {String} columnName for ID
 */
DataSource.prototype.idColumnName = function (modelName) {
  return this.getModelDefinition(modelName).idColumnName(this.connector.name);
};

/**
 * Find the ID property name
 * @param {String} modelName The model name
 * @returns {String} property name for ID
 */
DataSource.prototype.idName = function (modelName) {
  if (!this.getModelDefinition(modelName).idName) {
    console.error('No id name', this.getModelDefinition(modelName));
  }
  return this.getModelDefinition(modelName).idName();
};

/**
 * Find the ID property names sorted by the index
 * @param {String} modelName The model name
 * @returns {String[]} property names for IDs
 */
DataSource.prototype.idNames = function (modelName) {
  return this.getModelDefinition(modelName).idNames();
};

/**
 * Find the id property definition
 * @param {String} modelName The model name
 * @returns {Object} The id property definition
 */
DataSource.prototype.idProperty = function (modelName) {
  var def = this.getModelDefinition(modelName);
  var idProps = def && def.ids();
  return idProps && idProps[0] && idProps[0].property;
};

/**
 * Define foreign key to another model
 * @param {String} className The model name that owns the key
 * @param {String} key Name of key field
 * @param {String} foreignClassName The foreign model name
 */
DataSource.prototype.defineForeignKey = function defineForeignKey(className, key, foreignClassName) {
  // quit if key already defined
  if (this.getModelDefinition(className).rawProperties[key]) return;

  var defaultType = Number;
  if (foreignClassName) {
    var foreignModel = this.getModelDefinition(foreignClassName);
    var pkName = foreignModel && foreignModel.idName();
    if (pkName) {
      defaultType = foreignModel.properties[pkName].type;
    }
  }
  if (this.connector.defineForeignKey) {
    var cb = function (err, keyType) {
      if (err) throw err;
      // Add the foreign key property to the data source _models
      this.defineProperty(className, key, {type: keyType || defaultType});
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
    this.defineProperty(className, key, {type: defaultType});
  }

};

/**
 * Close database connection
 * @param {Fucntion} cb The callback function. Optional.
 */
DataSource.prototype.disconnect = function disconnect(cb) {
  var self = this;
  if (this.connected && (typeof this.connector.disconnect === 'function')) {
    this.connector.disconnect(function (err, result) {
      self.connected = false;
      cb && cb(err, result);
    });
  } else {
    process.nextTick(function () {
      cb && cb();
    });
  }
};

/**
 * Copy the model from Master.
 * @param {Function} Master The model constructor
 * @returns {Function} The copy of the model constructor
 *
 * @private
 */
DataSource.prototype.copyModel = function copyModel(Master) {
  var dataSource = this;
  var className = Master.modelName;
  var md = Master.modelBuilder.getModelDefinition(className);
  var Slave = function SlaveModel() {
    Master.apply(this, [].slice.call(arguments));
  };

  util.inherits(Slave, Master);

  // Delegating static properties
  Slave.__proto__ = Master;

  hiddenProperty(Slave, 'dataSource', dataSource);
  hiddenProperty(Slave, 'modelName', className);
  hiddenProperty(Slave, 'relations', Master.relations);

  if (!(className in dataSource.modelBuilder.models)) {

    // store class in model pool
    dataSource.modelBuilder.models[className] = Slave;
    dataSource.modelBuilder.definitions[className] = new ModelDefinition(dataSource.modelBuilder, md.name, md.properties, md.settings);

    if ((!dataSource.isTransaction) && dataSource.connector && dataSource.connector.define) {
      dataSource.connector.define({
        model: Slave,
        properties: md.properties,
        settings: md.settings
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
DataSource.prototype.transaction = function () {
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
  transaction.modelBuilder = new ModelBuilder();
  transaction.models = transaction.modelBuilder.models;
  transaction.definitions = transaction.modelBuilder.definitions;

  for (var i in dataSource.modelBuilder.models) {
    dataSource.copyModel.call(transaction, dataSource.modelBuilder.models[i]);
  }

  transaction.exec = function (cb) {
    transaction.connector.exec(cb);
  };

  return transaction;
};

/**
 * Enable remote access to a data source operation. Each [connector](#connector) has its own set of set
 * remotely enabled and disabled operations. To list the operations, call `dataSource.operations()`.
 * @param {String} operation The operation name
 */

DataSource.prototype.enableRemote = function (operation) {
  var op = this.getOperation(operation);
  if (op) {
    op.remoteEnabled = true;
  } else {
    throw new Error(operation + ' is not provided by the attached connector');
  }
}

/**
 * Disable remote access to a data source operation. Each [connector](#connector) has its own set of set enabled
 * and disabled operations. To list the operations, call `dataSource.operations()`.
 * 
 *```js
 *
 * var oracle = loopback.createDataSource({
 *   connector: require('loopback-connector-oracle'),
 *   host: '...',
 *   ...
 * });
 * oracle.disableRemote('destroyAll');
 * ```
 * **Notes:**
 * 
 * - Disabled operations will not be added to attached models.
 *  - Disabling the remoting for a method only affects client access (it will still be available from server models).
 *  - Data sources must enable / disable operations before attaching or creating models.
 * @param {String} operation The operation name
 */

DataSource.prototype.disableRemote = function (operation) {
  var op = this.getOperation(operation);
  if (op) {
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

  for (var i = 0; i < opKeys.length; i++) {
    var op = ops[opKeys[i]];

    if (op.name === operation) {
      return op;
    }
  }
}

/**
 * Return JSON object describing all operations.
 *
 * Example return value:
 * ```js
 * {
 *  find: {
 *    remoteEnabled: true,
 *    accepts: [...],
 *    returns: [...]
 *    enabled: true
 * },
 *  save: {
 *    remoteEnabled: true,
 *    prototype: true,
 *    accepts: [...],
 *    returns: [...],
 *    enabled: true
 *  },
 *  ...
 * }
 * ```
 */
DataSource.prototype.operations = function () {
  return this._operations;
}

/**
 * Define an operation to the data source
 * @param {String} name The operation name
 * @param {Object} options The options
 * @param {Function} fn The function
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
DataSource.prototype.isRelational = function () {
  return this.connector && this.connector.relational;
};

/**
 * Check if the data source is ready.
 * Returns a Boolean value.
 * @param obj {Object} ?
 * @param args {Object} ?
 */
DataSource.prototype.ready = function (obj, args) {
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
    if (typeof cb === 'function') {
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

// Carry over a few properties/methods from the ModelBuilder as some tests use them
DataSource.Text = ModelBuilder.Text;
DataSource.JSON = ModelBuilder.JSON;
DataSource.Any = ModelBuilder.Any;

/*!
 * @deprecated Use ModelBuilder.registerType instead
 * @param type
 */
DataSource.registerType = function (type) {
  ModelBuilder.registerType(type);
};

