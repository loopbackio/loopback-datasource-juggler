// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// Turning on strict for this file breaks lots of test cases;
// disabling strict for this file
/* eslint-disable strict */

/*!
 * Module dependencies
 */
const ModelBuilder = require('./model-builder.js').ModelBuilder;
const ModelDefinition = require('./model-definition.js');
const RelationDefinition = require('./relation-definition.js');
const OberserverMixin = require('./observer');
const jutil = require('./jutil');
const utils = require('./utils');
const ModelBaseClass = require('./model.js');
const DataAccessObject = require('./dao.js');
const defineScope = require('./scope.js').defineScope;
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const assert = require('assert');
const async = require('async');
const traverse = require('traverse');
const g = require('strong-globalize')();
const juggler = require('..');
const deprecated = require('depd')('loopback-datasource-juggler');
const Transaction = require('loopback-connector').Transaction;

if (process.env.DEBUG === 'loopback') {
  // For back-compatibility
  process.env.DEBUG = 'loopback:*';
}
const debug = require('debug')('loopback:datasource');

/*!
 * Export public API
 */
exports.DataSource = DataSource;

/*!
 * Helpers
 */
const slice = Array.prototype.slice;

/**
 * LoopBack models can manipulate data via the DataSource object.
 * Attaching a `DataSource` to a `Model` adds instance methods and static methods to the `Model`.
 *
 * Define a data source to persist model data.
 * To create a DataSource programmatically, call `createDataSource()` on the LoopBack object; for example:
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
 * one database connection.
 *
 * For example, the following creates a DataSource, and waits for a connection callback.
 *
 * ```
 * var dataSource = new DataSource('mysql', { database: 'myapp_test' });
 * dataSource.define(...);
 * dataSource.on('connected', function () {
 *     // work with database
 * });
 * ```
 * @class DataSource
 * @param {String} [name] Optional name for datasource.
 * @options {Object} settings Database-specific settings to establish connection (settings depend on specific connector).
 * The table below lists a typical set for a relational database.
 * @property {String} connector Database connector to use.  For any supported connector, can be any of:
 *
 * - The connector module from `require(connectorName)`.
 * - The full name of the connector module, such as 'loopback-connector-oracle'.
 * - The short name of the connector module, such as 'oracle'.
 * - A local module under `./connectors/` folder.
 * @property {String} host Database server host name.
 * @property {String} port Database server port number.
 * @property {String} username Database user name.
 * @property {String} password Database password.
 * @property {String} database Name of the database to use.
 * @property {Boolean} debug Display debugging information. Default is false.
 *
 * The constructor allows the following styles:
 *
 * 1. new DataSource(dataSourceName, settings). For example:
 *   - new DataSource('myDataSource', {connector: 'memory'});
 *   - new DataSource('myDataSource', {name: 'myDataSource', connector: 'memory'});
 *   - new DataSource('myDataSource', {name: 'anotherDataSource', connector: 'memory'});
 *
 * 2. new DataSource(settings). For example:
 *   - new DataSource({name: 'myDataSource', connector: 'memory'});
 *   - new DataSource({connector: 'memory'});
 *
 * 3. new DataSource(connectorModule, settings). For example:
 *   - new DataSource(connectorModule, {name: 'myDataSource})
 *   - new DataSource(connectorModule)
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
  this.juggler = juggler;

  // operation metadata
  // Initialize it before calling setup as the connector might register operations
  this._operations = {};

  this.setup(name, settings);

  this._setupConnector();

  // connector
  const connector = this.connector;

  // DataAccessObject - connector defined or supply the default
  const dao = (connector && connector.DataAccessObject) || this.constructor.DataAccessObject;
  this.DataAccessObject = function() {
  };

  // define DataAccessObject methods
  Object.keys(dao).forEach(function(name) {
    const fn = dao[name];
    this.DataAccessObject[name] = fn;

    if (typeof fn === 'function') {
      this.defineOperation(name, {
        accepts: fn.accepts,
        'returns': fn.returns,
        http: fn.http,
        remoteEnabled: fn.shared ? true : false,
        scope: this.DataAccessObject,
        fnName: name,
      });
    }
  }.bind(this));

  // define DataAccessObject.prototype methods
  Object.keys(dao.prototype || []).forEach(function(name) {
    const fn = dao.prototype[name];
    this.DataAccessObject.prototype[name] = fn;
    if (typeof fn === 'function') {
      this.defineOperation(name, {
        prototype: true,
        accepts: fn.accepts,
        'returns': fn.returns,
        http: fn.http,
        remoteEnabled: fn.shared ? true : false,
        scope: this.DataAccessObject.prototype,
        fnName: name,
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
DataSource.prototype._setupConnector = function() {
  this.connector = this.connector || this.adapter; // The legacy JugglingDB adapter will set up `adapter` property
  this.adapter = this.connector; // Keep the adapter as an alias to connector
  if (this.connector) {
    if (!this.connector.dataSource) {
      // Set up the dataSource if the connector doesn't do so
      this.connector.dataSource = this;
    }
    const dataSource = this;
    this.connector.log = function(query, start) {
      dataSource.log(query, start);
    };

    this.connector.logger = function(query) {
      const t1 = Date.now();
      const log = this.log;
      return function(q) {
        log(q || query, t1);
      };
    };
    // Configure the connector instance to mix in observer functions
    jutil.mixin(this.connector, OberserverMixin);
  }
};

// List possible connector module names
function connectorModuleNames(name) {
  const names = []; // Check the name as is
  if (!name.match(/^\//)) {
    names.push('./connectors/' + name); // Check built-in connectors
    if (name.indexOf('loopback-connector-') !== 0) {
      names.push('loopback-connector-' + name); // Try loopback-connector-<name>
    }
  }
  // Only try the short name if the connector is not from StrongLoop
  if (['mongodb', 'oracle', 'mysql', 'postgresql', 'mssql', 'rest', 'soap', 'db2', 'cloudant']
    .indexOf(name) === -1) {
    names.push(name);
  }
  return names;
}

// testable with DI
function tryModules(names, loader) {
  let mod;
  loader = loader || require;
  for (let m = 0; m < names.length; m++) {
    try {
      mod = loader(names[m]);
    } catch (e) {
      const notFound = e.code === 'MODULE_NOT_FOUND' &&
        e.message && e.message.indexOf(names[m]) > 0;

      if (notFound) {
        debug('Module %s not found, will try another candidate.', names[m]);
        continue;
      }

      debug('Cannot load connector %s: %s', names[m], e.stack || e);
      throw e;
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
DataSource._resolveConnector = function(name, loader) {
  const names = connectorModuleNames(name);
  const connector = tryModules(names, loader);
  let error = null;
  if (!connector) {
    error = g.f('\nWARNING: {{LoopBack}} connector "%s" is not installed ' +
      'as any of the following modules:\n\n %s\n\nTo fix, run:\n\n    {{npm install %s --save}}\n',
    name, names.join('\n'), names[names.length - 1]);
  }
  return {
    connector: connector,
    error: error,
  };
};

/**
 * Connect to the data source.
 * If no callback is provided, it will return a Promise.
 * Emits the 'connect' event.
 * @param callback
 * @returns {Promise}
 * @emits connected
 */
DataSource.prototype.connect = function(callback) {
  callback = callback || utils.createPromiseCallback();
  const self = this;
  if (this.connected) {
    // The data source is already connected, return immediately
    process.nextTick(callback);
    return callback.promise;
  }
  if (typeof this.connector.connect !== 'function') {
    // Connector doesn't have the connect function
    // Assume no connect is needed
    self.connected = true;
    self.connecting = false;
    process.nextTick(function() {
      self.emit('connected');
      callback();
    });
    return callback.promise;
  }

  // Queue the callback
  this.pendingConnectCallbacks = this.pendingConnectCallbacks || [];
  this.pendingConnectCallbacks.push(callback);

  // The connect is already in progress
  if (this.connecting) return callback.promise;
  this.connector.connect(function(err, result) {
    self.connecting = false;
    if (!err) self.connected = true;
    const cbs = self.pendingConnectCallbacks;
    self.pendingConnectCallbacks = [];
    if (!err) {
      self.emit('connected');
    } else {
      self.emit('error', err);
    }
    // Invoke all pending callbacks
    async.each(cbs, function(cb, done) {
      try {
        cb(err);
      } catch (e) {
        // Ignore error to make sure all callbacks are invoked
        debug('Uncaught error raised by connect callback function: ', e);
      } finally {
        done();
      }
    }, function(err) {
      if (err) throw err; // It should not happen
    });
  });

  // Set connecting flag to be `true` so that the connector knows there is
  // a connect in progress. The change of `connecting` should happen immediately
  // after the connect request is sent
  this.connecting = true;
  return callback.promise;
};

/**
 * Set up the data source. The following styles are supported:
 * ```js
 * ds.setup('myDataSource', {connector: 'memory'}); // ds.name -> 'myDataSource'
 * ds.setup('myDataSource', {name: 'myDataSource', connector: 'memory'}); // ds.name -> 'myDataSource'
 * ds.setup('myDataSource', {name: 'anotherDataSource', connector: 'memory'}); // ds.name -> 'myDataSource' and a warning will be issued
 * ds.setup({name: 'myDataSource', connector: 'memory'}); // ds.name -> 'myDataSource'
 * ds.setup({connector: 'memory'}); // ds.name -> 'memory'
 * ```
 * @param {String} dsName The name of the datasource. If not set, use
 * `settings.name`
 * @param {Object} settings The settings
 * @returns {*}
 * @private
 */
DataSource.prototype.setup = function(dsName, settings) {
  const dataSource = this;
  let connector;

  // First argument is an `object`
  if (dsName && typeof dsName === 'object') {
    if (settings === undefined) {
      // setup({name: 'myDataSource', connector: 'memory'})
      settings = dsName;
      dsName = undefined;
    } else {
      // setup(connector, {name: 'myDataSource', host: 'localhost'})
      connector = dsName;
      dsName = undefined;
    }
  }

  if (typeof dsName !== 'string') {
    dsName = undefined;
  }

  if (typeof settings === 'object') {
    if (settings.initialize) {
      // Settings is the resolved connector instance
      connector = settings;
      // Set settings to undefined to avoid confusion
      settings = undefined;
    } else if (settings.connector) {
      // Use `connector`
      connector = settings.connector;
    } else if (settings.adapter) {
      // `adapter` as alias for `connector`
      connector = settings.adapter;
    }
  }

  // just save everything we get
  this.settings = settings || {};

  this.settings.debug = this.settings.debug || debug.enabled;

  if (this.settings.debug) {
    debug('Settings: %j', this.settings);
  }

  if (typeof settings === 'object' && typeof settings.name === 'string' &&
      typeof dsName === 'string' && dsName !== settings.name) {
    // setup('myDataSource', {name: 'anotherDataSource', connector: 'memory'});
    // ds.name -> 'myDataSource' and a warning will be issued
    console.warn(
      'A datasource is created with name %j, which is different from the name in settings (%j). ' +
      'Please adjust your configuration to ensure these names match.',
      dsName, settings.name
    );
  }

  // Disconnected by default
  this.connected = false;
  this.connecting = false;
  this.initialized = false;

  this.name = dsName || (typeof this.settings.name === 'string' && this.settings.name);

  let connectorName;
  if (typeof connector === 'string') {
    // Connector needs to be resolved by name
    connectorName = connector;
    connector = undefined;
  } else if ((typeof connector === 'object') && connector) {
    connectorName = connector.name;
  } else {
    connectorName = dsName;
  }
  if (!this.name) {
    // Fall back to connector name
    this.name = connectorName;
  }

  if ((!connector) && connectorName) {
    // The connector has not been resolved
    const result = DataSource._resolveConnector(connectorName);
    connector = result.connector;
    if (!connector) {
      console.error(result.error);
      this.emit('error', new Error(result.error));
      return;
    }
  }

  if (connector) {
    const postInit = function postInit(err, result) {
      this._setupConnector();
      // we have an connector now?
      if (!this.connector) {
        throw new Error(g.f('Connector is not defined correctly: ' +
          'it should create `{{connector}}` member of dataSource'));
      }
      if (!err) {
        this.initialized = true;
        this.emit('initialized');
      }
      debug('Connector is initialized for dataSource %s', this.name);
      // If `result` is set to `false` explicitly, the connection will be
      // lazily established
      if (!this.settings.lazyConnect) {
        this.connected = (!err) && (result !== false); // Connected now
      }
      if (this.connected) {
        debug('DataSource %s is now connected to %s', this.name, this.connector.name);
        this.emit('connected');
      } else {
        // The connection fails, let's report it and hope it will be recovered in the next call
        if (err) {
          // Reset the connecting to `false`
          this.connecting = false;
          g.error('Connection fails: %s\nIt will be retried for the next request.', err);
          this.emit('error', err);
        } else {
          // Either lazyConnect or connector initialize() defers the connection
          debug('DataSource %s will be connected to connector %s', this.name,
            this.connector.name);
        }
      }
    }.bind(this);

    try {
      if ('function' === typeof connector.initialize) {
        // Call the async initialize method
        debug('Initializing connector %s', connector.name);
        connector.initialize(this, postInit);
      } else if ('function' === typeof connector) {
        // Use the connector constructor directly
        this.connector = new connector(this.settings);
        postInit();
      }
    } catch (err) {
      if (err.message) {
        err.message = 'Cannot initialize connector ' +
          JSON.stringify(connectorName) + ': ' +
          err.message;
      }
      throw err;
    }
  }
};

function isModelClass(cls) {
  if (!cls) {
    return false;
  }
  return cls.prototype instanceof ModelBaseClass;
}

DataSource.relationTypes = Object.keys(RelationDefinition.RelationTypes);

function isModelDataSourceAttached(model) {
  return model && (!model.settings.unresolved) && (model.dataSource instanceof DataSource);
}

/*!
 * Define scopes for the model class from the scopes object. See
 * [scopes](./Model-definition-JSON-file.html#scopes) for more information on
 * scopes and valid options objects.
 * @param {Object} modelClass - The model class that corresponds to the model
 * definition that will be enhanced by the provided scopes.
 * @param {Object} scopes A key-value collection of names and their object
 * definitions
 * @property options The options defined on the scope object.
 */
DataSource.prototype.defineScopes = function(modelClass, scopes) {
  if (scopes) {
    for (const s in scopes) {
      defineScope(modelClass, modelClass, s, scopes[s], {}, scopes[s].options);
    }
  }
};

/*!
 * Define relations for the model class from the relations object. See
 * [relations](./Model-definition-JSON-file.html#relations) for more information.
 * @param {Object} modelClass - The model class that corresponds to the model
 * definition that will be enhanced by the provided relations.
 * @param {Object} relations A key-value collection of relation names and their
 * object definitions.
 */
DataSource.prototype.defineRelations = function(modelClass, relations) {
  const self = this;

  // Wait for target/through models to be attached before setting up the relation
  const deferRelationSetup = function(relationName, relation, targetModel, throughModel) {
    if (!isModelDataSourceAttached(targetModel)) {
      targetModel.once('dataAccessConfigured', function(targetModel) {
        // Check if the through model doesn't exist or resolved
        if (!throughModel || isModelDataSourceAttached(throughModel)) {
          // The target model is resolved
          const params = traverse(relation).clone();
          params.as = relationName;
          params.model = targetModel;
          if (throughModel) {
            params.through = throughModel;
          }
          modelClass[relation.type].call(modelClass, relationName, params);
        }
      });
    }

    if (throughModel && !isModelDataSourceAttached(throughModel)) {
      // Set up a listener to the through model
      throughModel.once('dataAccessConfigured', function(throughModel) {
        if (isModelDataSourceAttached(targetModel)) {
          // The target model is resolved
          const params = traverse(relation).clone();
          params.as = relationName;
          params.model = targetModel;
          params.through = throughModel;
          modelClass[relation.type].call(modelClass, relationName, params);
        }
      });
    }
  };

  // Set up the relations
  if (relations) {
    Object.keys(relations).forEach(function(relationName) {
      let targetModel;
      const r = relations[relationName];

      validateRelation(relationName, r);

      if (r.model) {
        targetModel = isModelClass(r.model) ? r.model : self.getModel(r.model, true);
      }

      let throughModel = null;
      if (r.through) {
        throughModel = isModelClass(r.through) ? r.through : self.getModel(r.through, true);
      }

      if ((targetModel && !isModelDataSourceAttached(targetModel)) ||
          (throughModel && !isModelDataSourceAttached(throughModel))) {
        // Create a listener to defer the relation set up
        deferRelationSetup(relationName, r, targetModel, throughModel);
      } else {
        // The target model is resolved
        const params = traverse(r).clone();
        params.as = relationName;
        params.model = targetModel;
        if (throughModel) {
          params.through = throughModel;
        }
        modelClass[r.type].call(modelClass, relationName, params);
      }
    });
  }
};

function validateRelation(relationName, relation) {
  const rn = relationName;
  const r = relation;
  let msg, code;

  assert(DataSource.relationTypes.indexOf(r.type) !== -1, 'Invalid relation type: ' + r.type);
  assert(isValidRelationName(rn), 'Invalid relation name: ' + rn);

  // VALIDATION ERRORS

  // non polymorphic belongsTo relations should have `model` defined
  if (!r.polymorphic && r.type === 'belongsTo' && !r.model) {
    msg = g.f('%s relation: %s requires param `model`', r.type, rn);
    code = 'BELONGS_TO_MISSING_MODEL';
  }
  // polymorphic belongsTo relations should not have `model` defined
  if (r.polymorphic && r.type === 'belongsTo' && r.model) {
    msg = g.f('{{polymorphic}} %s relation: %s does not expect param `model`', r.type, rn);
    code = 'POLYMORPHIC_BELONGS_TO_MODEL';
  }
  // polymorphic relations other than belongsTo should have `model` defined
  if (r.polymorphic && r.type !== 'belongsTo' && !r.model) {
    msg = g.f('{{polymorphic}} %s relation: %s requires param `model`', r.type, rn);
    code = 'POLYMORPHIC_NOT_BELONGS_TO_MISSING_MODEL';
  }
  // polymorphic relations should provide both discriminator and foreignKey or none
  if (r.polymorphic && r.polymorphic.foreignKey && !r.polymorphic.discriminator) {
    msg = g.f('{{polymorphic}} %s relation: %s requires param `polymorphic.discriminator` ' +
    'when param `polymorphic.foreignKey` is provided', r.type, rn);
    code = 'POLYMORPHIC_MISSING_DISCRIMINATOR';
  }
  // polymorphic relations should provide both discriminator and foreignKey or none
  if (r.polymorphic && r.polymorphic.discriminator && !r.polymorphic.foreignKey) {
    msg = g.f('{{polymorphic}} %s relation: %s requires param `polymorphic.foreignKey` ' +
    'when param `polymorphic.discriminator` is provided', r.type, rn);
    code = 'POLYMORPHIC_MISSING_FOREIGN_KEY';
  }
  // polymorphic relations should not provide polymorphic.as when using custom foreignKey/discriminator
  if (r.polymorphic && r.polymorphic.as && r.polymorphic.foreignKey) {
    msg = g.f('{{polymorphic}} %s relation: %s does not expect param `polymorphic.as` ' +
    'when defing custom `foreignKey`/`discriminator` ', r.type, rn);
    code = 'POLYMORPHIC_EXTRANEOUS_AS';
  }
  // polymorphic relations should not provide polymorphic.as when using custom foreignKey/discriminator
  if (r.polymorphic && r.polymorphic.selector && r.polymorphic.foreignKey) {
    msg = g.f('{{polymorphic}} %s relation: %s does not expect param `polymorphic.selector` ' +
    'when defing custom `foreignKey`/`discriminator` ', r.type, rn);
    code = 'POLYMORPHIC_EXTRANEOUS_SELECTOR';
  }

  if (msg) {
    const error = new Error(msg);
    error.details = {code: code, rType: r.type, rName: rn};
    throw error;
  }

  // DEPRECATION WARNINGS
  if (r.polymorphic && r.polymorphic.as) {
    deprecated(g.f('WARNING: {{polymorphic}} %s relation: %s uses keyword `polymorphic.as` which will ' +
    'be DEPRECATED in LoopBack.next, refer to this doc for replacement solutions ' +
    '(https://loopback.io/doc/en/lb3/Polymorphic-relations.html#deprecated-polymorphic-as)',
    r.type, rn), r.type);
  }
}

function isValidRelationName(relationName) {
  const invalidRelationNames = ['trigger'];
  return invalidRelationNames.indexOf(relationName) === -1;
}

/*!
 * Set up the data access functions from the data source. Each data source will
 * expose a data access object (DAO), which will be mixed into the modelClass.
 * @param {Model} modelClass The model class that will receive DAO mixins.
 * @param {Object} settings The settings object; typically allows any settings
 * that would be valid for a typical Model object.
 */
DataSource.prototype.setupDataAccess = function(modelClass, settings) {
  if (this.connector) {
    // Check if the id property should be generated
    const idName = modelClass.definition.idName();
    const idProp = modelClass.definition.rawProperties[idName];
    if (idProp && idProp.generated && this.connector.getDefaultIdType) {
      // Set the default id type from connector's ability
      const idType = this.connector.getDefaultIdType() || String;
      idProp.type = idType;
      modelClass.definition.rawProperties[idName].type = idType;
      modelClass.definition.properties[idName].type = idType;
    }
    if (this.connector.define) {
      // pass control to connector
      this.connector.define({
        model: modelClass,
        properties: modelClass.definition.properties,
        settings: settings,
      });
    }
  }

  // add data access objects
  this.mixin(modelClass);

  // define relations from LDL (options.relations)
  const relations = settings.relationships || settings.relations;
  this.defineRelations(modelClass, relations);

  // Emit the dataAccessConfigured event to indicate all the methods for data
  // access have been mixed into the model class
  modelClass.emit('dataAccessConfigured', modelClass);

  // define scopes from LDL (options.relations)
  const scopes = settings.scopes || {};
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
 * @param {Object} settings A settings object that would typically be used for Model objects.
 */

DataSource.prototype.createModel =
DataSource.prototype.define = function defineClass(className, properties, settings) {
  const args = slice.call(arguments);

  if (!className) {
    throw new Error(g.f('Class name required'));
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

  const modelClass = this.modelBuilder.define(className, properties, settings);
  modelClass.dataSource = this;

  if (settings.unresolved) {
    return modelClass;
  }

  this.setupDataAccess(modelClass, settings);
  modelClass.emit('dataSourceAttached', modelClass);

  return modelClass;
};

/**
 * Remove a model from the registry.
 *
 * @param {String} modelName
 */
DataSource.prototype.deleteModelByName = function(modelName) {
  this.modelBuilder.deleteModelByName(modelName);
  delete this.connector._models[modelName];
};

/**
 * Mixin DataAccessObject methods.
 *
 * @param {Function} ModelCtor The model constructor
 * @private
 */

DataSource.prototype.mixin = function(ModelCtor) {
  const ops = this.operations();
  const DAO = this.DataAccessObject;

  // mixin DAO
  jutil.mixin(ModelCtor, DAO, {proxyFunctions: true, override: true});

  // decorate operations as alias functions
  Object.keys(ops).forEach(function(name) {
    const op = ops[name];
    let scope;

    if (op.enabled) {
      scope = op.prototype ? ModelCtor.prototype : ModelCtor;
      // var sfn = scope[name] = function () {
      //   op.scope[op.fnName].apply(self, arguments);
      // }
      Object.keys(op)
        .filter(function(key) {
          // filter out the following keys
          return ~[
            'scope',
            'fnName',
            'prototype',
          ].indexOf(key);
        })
        .forEach(function(key) {
          if (typeof op[key] !== 'undefined') {
            op.scope[op.fnName][key] = op[key];
          }
        });
    }
  });
};

/*! Method will be deprecated in LoopBack.next
*/
/**
 * See [ModelBuilder.getModel](http://apidocs.strongloop.com/loopback-datasource-juggler/#modelbuilder-prototype-getmodel)
 * for details.
 */
DataSource.prototype.getModel = function(name, forceCreate) {
  return this.modelBuilder.getModel(name, forceCreate);
};

/*! Method will be deprecated in LoopBack.next
*/
/**
 * See ModelBuilder.getModelDefinition
 * See [ModelBuilder.getModelDefinition](http://apidocs.strongloop.com/loopback-datasource-juggler/#modelbuilder-prototype-getmodeldefinition)
 * for details.
 */
DataSource.prototype.getModelDefinition = function(name) {
  return this.modelBuilder.getModelDefinition(name);
};

/*! Method will be deprecated in LoopBack.next
*/
/**
 * Get the data source types collection.
 * @returns {String[]} The data source type array.
 * For example, ['db', 'nosql', 'mongodb'] would be represent a datasource of
 * type 'db', with a subtype of 'nosql', and would use the 'mongodb' connector.
 *
 * Alternatively, ['rest'] would be a different type altogether, and would have
 * no subtype.
 */
DataSource.prototype.getTypes = function() {
  const getTypes = this.connector && this.connector.getTypes;
  let types = getTypes && getTypes() || [];
  if (typeof types === 'string') {
    types = types.split(/[\s,\/]+/);
  }
  return types;
};

/**
 * Check the data source supports the specified types.
 * @param {String|String[]} types Type name or an array of type names.
 * @returns {Boolean} true if all types are supported by the data source
 */
DataSource.prototype.supportTypes = function(types) {
  const supportedTypes = this.getTypes();
  if (Array.isArray(types)) {
    // Check each of the types
    for (let i = 0; i < types.length; i++) {
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

/*! In future versions, this will not maintain a strict 1:1 relationship between datasources and model classes
* Moving forward, we will allow a model to be attached to a datasource. The model itself becomes a template.
*/
/**
 * Attach an existing model to a data source.
 * This will mixin all of the data access object functions (DAO) into your
 * modelClass definition.
 * @param {Function} modelClass The model constructor that will be enhanced by
 * DAO mixins.
 */

DataSource.prototype.attach = function(modelClass) {
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

/*! Method will be deprecated in LoopBack.next
*/
/**
 * Define a property with name `prop` on a target `model`. See
 * [Properties](./Model-definition-JSON-file.html#properties) for more information
 * regarding valid options for `params`.
 * @param {String} model Name of model
 * @param {String} prop Name of property
 * @param {Property} params Property settings
 */
DataSource.prototype.defineProperty = function(model, prop, params) {
  this.modelBuilder.defineProperty(model, prop, params);

  const resolvedProp = this.getModelDefinition(model).properties[prop];
  if (this.connector && this.connector.defineProperty) {
    this.connector.defineProperty(model, prop, resolvedProp);
  }
};

/**
 * Drop schema objects such as tables, indexes, views, triggers, etc that correspond
 * to model definitions attached to this DataSource instance, specified by the `models` parameter.
 *
 * **WARNING**: In many situations, this will destroy data! `autoupdate()` will attempt to preserve
 * data while updating the schema on your target DataSource, but this is not guaranteed to be safe.
 *
 * Please check the documentation for your specific connector(s) for a detailed breakdown of
 * behaviors for automigrate!
 *
 * @param {String|String[]} [models] Model(s) to migrate.  If not present, apply to all models.
 * @param {Function} [callback] Callback function. Optional.
 *
 */
DataSource.prototype.automigrate = function(models, cb) {
  this.freeze();

  if ((!cb) && ('function' === typeof models)) {
    cb = models;
    models = undefined;
  }

  cb = cb || utils.createPromiseCallback();

  if (!this.connector.automigrate) {
    // NOOP
    process.nextTick(cb);
    return cb.promise;
  }

  // First argument is a model name
  if ('string' === typeof models) {
    models = [models];
  }

  const attachedModels = this.connector._models;

  if (attachedModels && typeof attachedModels === 'object') {
    models = models || Object.keys(attachedModels);

    if (models.length === 0) {
      process.nextTick(cb);
      return cb.promise;
    }

    const invalidModels = models.filter(function(m) {
      return !(m in attachedModels);
    });

    if (invalidModels.length) {
      process.nextTick(function() {
        cb(new Error(g.f('Cannot migrate models not attached to this datasource: %s',
          invalidModels.join(' '))));
      });
      return cb.promise;
    }
  }

  this.connector.automigrate(models, cb);
  return cb.promise;
};

/**
 * Update existing database tables.
 * This method applies only to database connectors.
 *
 * **WARNING**: `autoupdate()` will attempt to preserve data while updating the
 * schema on your target DataSource, but this is not guaranteed to be safe.
 *
 * Please check the documentation for your specific connector(s) for a detailed breakdown of
 * behaviors for automigrate!*
 *
 * @param {String|String[]} [models] Model(s) to migrate.  If not present, apply to all models.
 * @param {Function} [cb] The callback function
 */
DataSource.prototype.autoupdate = function(models, cb) {
  this.freeze();

  if ((!cb) && ('function' === typeof models)) {
    cb = models;
    models = undefined;
  }

  cb = cb || utils.createPromiseCallback();

  if (!this.connector.autoupdate) {
    // NOOP
    process.nextTick(cb);
    return cb.promise;
  }

  // First argument is a model name
  if ('string' === typeof models) {
    models = [models];
  }

  const attachedModels = this.connector._models;

  if (attachedModels && typeof attachedModels === 'object') {
    models = models || Object.keys(attachedModels);

    if (models.length === 0) {
      process.nextTick(cb);
      return cb.promise;
    }

    const invalidModels = models.filter(function(m) {
      return !(m in attachedModels);
    });

    if (invalidModels.length) {
      process.nextTick(function() {
        cb(new Error(g.f('Cannot migrate models not attached to this datasource: %s',
          invalidModels.join(' '))));
      });
      return cb.promise;
    }
  }

  this.connector.autoupdate(models, cb);
  return cb.promise;
};

/**
 * Discover existing database tables.
 * This method returns an array of model objects, including {type, name, onwer}
 *
 * @options {Object} options Discovery options.  See below.
 * @param {Function} Callback function.  Optional.
 * @property {String} owner/schema The owner or schema to discover from.
 * @property {Boolean} all If true, discover all models; if false, discover only models owned by the current user.
 * @property {Boolean} views If true, include views; if false, only tables.
 * @property {Number} limit Page size
 * @property {Number} offset Starting index
 * @returns {ModelDefinition[]}
 */
DataSource.prototype.discoverModelDefinitions = function(options, cb) {
  this.freeze();

  if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = {};
  }
  options = options || {};
  cb = cb || utils.createPromiseCallback();

  if (this.connector.discoverModelDefinitions) {
    this.connector.discoverModelDefinitions(options, cb);
  } else if (cb) {
    process.nextTick(cb);
  }
  return cb.promise;
};

/*! Method will be completely removed in LoopBack.next
*/
/**
 * The synchronous version of discoverModelDefinitions.
 * @options {Object} options The options
 * @property {Boolean} all If true, discover all models; if false, discover only models owned by the current user.
 * @property {Boolean} views If true, nclude views; if false, only tables.
 * @property {Number} limit Page size
 * @property {Number} offset Starting index
 * @returns {ModelDefinition[]}
 */
DataSource.prototype.discoverModelDefinitionsSync = function(options) {
  this.freeze();
  if (this.connector.discoverModelDefinitionsSync) {
    return this.connector.discoverModelDefinitionsSync(options);
  }
  return null;
};

/**
 * Discover properties for a given model.
 *
 * Callback function return value is an object that can have the following properties:
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
 * See [Properties](./Model-definition-JSON-file.html#properties) for more
 * details on the Property return type.
 * @param {String} modelName The table/view name
 * @options {Object} options The options
 * @property {String} owner|schema The database owner or schema
 * @param {Function} cb Callback function. Optional
 * @callback cb
 * @returns {Promise} A promise that returns an array of Properties (Property[])
 *
 */
DataSource.prototype.discoverModelProperties = function(modelName, options, cb) {
  this.freeze();

  if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = {};
  }
  options = options || {};
  cb = cb || utils.createPromiseCallback();

  if (this.connector.discoverModelProperties) {
    this.connector.discoverModelProperties(modelName, options, cb);
  } else if (cb) {
    process.nextTick(cb);
  }
  return cb.promise;
};

/*! Method will be completely removed in LoopBack.next
*/
/**
 * The synchronous version of discoverModelProperties
 * @param {String} modelName The table/view name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverModelPropertiesSync = function(modelName, options) {
  this.freeze();
  if (this.connector.discoverModelPropertiesSync) {
    return this.connector.discoverModelPropertiesSync(modelName, options);
  }
  return null;
};

/**
 * Discover primary keys for a given owner/modelName.
 * Callback function return value is an object that can have the following properties:
 *
 *| Key | Type | Description |
 *|-----|------|-------------|
 *| owner |String | Table schema or owner (may be null). Owner defaults to current user.
 *| tableName |String| Table name
 *| columnName |String| Column name
 *| keySeq |Number| Sequence number within primary key (1 indicates the first column in the primary key; 2 indicates the second column in the primary key).
 *| pkName |String| Primary key name (may be null)
 * See [ID Properties](./Model-definition-JSON-file.html#id-properties) for more
 * information.
 * @param {String} modelName The model name
 * @options {Object} options The options
 * @property {String} owner|schema The database owner or schema
 * @param {Function} [cb] The callback function
 * @returns {Promise} A promise with an array of Primary Keys (Property[])
 */
DataSource.prototype.discoverPrimaryKeys = function(modelName, options, cb) {
  this.freeze();

  if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = {};
  }
  options = options || {};
  cb = cb || utils.createPromiseCallback();

  if (this.connector.discoverPrimaryKeys) {
    this.connector.discoverPrimaryKeys(modelName, options, cb);
  } else if (cb) {
    process.nextTick(cb);
  }
  return cb.promise;
};

/*! Method will be completely removed in LoopBack.next
*/
/**
 * The synchronous version of discoverPrimaryKeys
 * @param {String} modelName The model name
 * @options {Object} options The options
 * @property {String} owner|schema The database owner or schema
 * @returns {*}
 */
DataSource.prototype.discoverPrimaryKeysSync = function(modelName, options) {
  this.freeze();
  if (this.connector.discoverPrimaryKeysSync) {
    return this.connector.discoverPrimaryKeysSync(modelName, options);
  }
  return null;
};

/**
 * Discover foreign keys for a given owner/modelName
 *
 * Callback function return value is an object that can have the following properties:
 *
 *| Key | Type | Description |
 *|-----|------|-------------|
 *|fkOwner |String | Foreign key table schema (may be null)
 *|fkName |String | Foreign key name (may be null)
 *|fkTableName |String | Foreign key table name
 *|fkColumnName |String | Foreign key column name
 *|keySeq |Number | Sequence number within a foreign key( a value of 1 represents the first column of the foreign key, a value of 2 would represent the second column within the foreign key).
 *|pkOwner |String | Primary key table schema being imported (may be null)
 *|pkName |String | Primary key name (may be null)
 *|pkTableName |String | Primary key table name being imported
 *|pkColumnName |String | Primary key column name being imported
 * See [Relations](/Model-definition-JSON-file.html#relations) for more
 * information.
 * @param {String} modelName The model name
 * @options {Object} options The options
 * @property {String} owner|schema The database owner or schema
 * @param {Function} [cb] The callback function
 * @returns {Promise} A Promise with an array of foreign key relations.
 *
 */
DataSource.prototype.discoverForeignKeys = function(modelName, options, cb) {
  this.freeze();

  if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = {};
  }
  options = options || {};
  cb = cb || utils.createPromiseCallback();

  if (this.connector.discoverForeignKeys) {
    this.connector.discoverForeignKeys(modelName, options, cb);
  } else if (cb) {
    process.nextTick(cb);
  }
  return cb.promise;
};

/*! Method will be completely removed in LoopBack.next
*/
/**
 * The synchronous version of discoverForeignKeys
 *
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverForeignKeysSync = function(modelName, options) {
  this.freeze();
  if (this.connector.discoverForeignKeysSync) {
    return this.connector.discoverForeignKeysSync(modelName, options);
  }
  return null;
};

/**
 * Retrieves a description of the foreign key columns that reference the given table's primary key columns
 * (the foreign keys exported by a table), ordered by fkTableOwner, fkTableName, and keySeq.
 *
 * Callback function return value is an object that can have the following properties:
 *
 *| Key | Type | Description |
 *|-----|------|-------------|
 *|fkOwner |String | Foreign key table schema (may be null)
 *|fkName |String | Foreign key name (may be null)
 *|fkTableName |String | Foreign key table name
 *|fkColumnName |String | Foreign key column name
 *|keySeq |Number | Sequence number within a foreign key( a value of 1 represents the first column of the foreign key, a value of 2 would represent the second column within the foreign key).
 *|pkOwner |String | Primary key table schema being imported (may be null)
 *|pkName |String | Primary key name (may be null)
 *|pkTableName |String | Primary key table name being imported
 *|pkColumnName |String | Primary key column name being imported
 * See [Relations](/Model-definition-JSON-file.html#relations) for more
 * information.
 *
 * @param {String} modelName The model name
 * @options {Object} options The options
 * @property {String} owner|schema The database owner or schema
 * @param {Function} [cb] The callback function
 * @returns {Promise} A Promise with an array of exported foreign key relations.
 */
DataSource.prototype.discoverExportedForeignKeys = function(modelName, options, cb) {
  this.freeze();

  if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = {};
  }
  options = options || {};
  cb = cb || utils.createPromiseCallback();

  if (this.connector.discoverExportedForeignKeys) {
    this.connector.discoverExportedForeignKeys(modelName, options, cb);
  } else if (cb) {
    process.nextTick(cb);
  }
  return cb.promise;
};

/*! Method will be completely removed in LoopBack.next
*/
/**
 * The synchronous version of discoverExportedForeignKeys
 * @param {String} modelName The model name
 * @param {Object} options The options
 * @returns {*}
 */
DataSource.prototype.discoverExportedForeignKeysSync = function(modelName, options) {
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
  const parts = dbName.split(/-|_/);
  parts[0] = camelCase ? parts[0].toLowerCase() : capitalize(parts[0]);

  for (let i = 1; i < parts.length; i++) {
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
 * @param {String} tableName The name of the table to discover.
 * @options {Object} [options] An options object typically used for Relations.
 * See [Relations](./Model-definition-JSON-file.html#relations) for more information.
 * @param {Function} [cb] The callback function
 * @returns {Promise} A promise object that resolves to a single schema.
 */
DataSource.prototype.discoverSchema = function(tableName, options, cb) {
  options = options || {};

  if (!cb && 'function' === typeof options) {
    cb = options;
    options = {};
  }
  options.visited = {};
  options.relations = false;

  cb = cb || utils.createPromiseCallback();

  this.discoverSchemas(tableName, options, function(err, schemas) {
    if (err || !schemas) {
      cb && cb(err, schemas);
      return;
    }
    for (const s in schemas) {
      cb && cb(null, schemas[s]);
      return;
    }
  });
  return cb.promise;
};

/**
 * Discover schema from a given tableName/viewName.
 *
 * @param {String} tableName The table name.
 * @options {Object} [options] Options; see below.
 * @property {String} owner|schema Database owner or schema name.
 * @property {Boolean} relations True if relations (primary key/foreign key) are navigated; false otherwise.
 * @property {Boolean} all True if all owners are included; false otherwise.
 * @property {Boolean} views True if views are included; false otherwise.
 * @param {Function} [cb] The callback function
 * @returns {Promise} A promise object that resolves to an array of schemas.
 */
DataSource.prototype.discoverSchemas = function(tableName, options, cb) {
  options = options || {};

  if (!cb && 'function' === typeof options) {
    cb = options;
    options = {};
  }

  cb = cb || utils.createPromiseCallback();

  const self = this;
  const dbType = this.connector.name;

  let nameMapper;
  if (options.nameMapper === null) {
    // No mapping
    nameMapper = function(type, name) {
      return name;
    };
  } else if (typeof options.nameMapper === 'function') {
    // Custom name mapper
    nameMapper = options.nameMapper;
  } else {
    // Default name mapper
    nameMapper = function mapName(type, name) {
      if (type === 'table' || type === 'model') {
        return fromDBName(name, false);
      } else if (type == 'fk') {
        return fromDBName(name + 'Rel', true);
      } else {
        return fromDBName(name, true);
      }
    };
  }

  if (this.connector.discoverSchemas) {
    // Delegate to the connector implementation
    this.connector.discoverSchemas(tableName, options, cb);
    return cb.promise;
  }

  const tasks = [
    this.discoverModelProperties.bind(this, tableName, options),
    this.discoverPrimaryKeys.bind(this, tableName, options)];

  const followingRelations = options.associations || options.relations;
  if (followingRelations) {
    tasks.push(this.discoverForeignKeys.bind(this, tableName, options));
  }

  async.parallel(tasks, function(err, results) {
    if (err) {
      cb(err);
      return cb.promise;
    }

    const columns = results[0];
    if (!columns || columns.length === 0) {
      cb(new Error(g.f('Table \'%s\' does not exist.', tableName)));
      return cb.promise;
    }

    // Handle primary keys
    const primaryKeys = results[1] || [];
    const pks = {};
    primaryKeys.forEach(function(pk) {
      pks[pk.columnName] = pk.keySeq;
    });

    if (self.settings.debug) {
      debug('Primary keys: ', pks);
    }

    const schema = {
      name: nameMapper('table', tableName),
      options: {
        idInjection: false, // DO NOT add id property
      },
      properties: {},
    };

    schema.options[dbType] = {
      schema: columns[0].owner,
      table: tableName,
    };

    columns.forEach(function(item) {
      const propName = nameMapper('column', item.columnName);
      schema.properties[propName] = {
        type: item.type,
        required: (item.nullable === 'N' || item.nullable === 'NO' ||
          item.nullable === 0 || item.nullable === false),
        length: item.dataLength,
        precision: item.dataPrecision,
        scale: item.dataScale,
      };

      if (pks[item.columnName]) {
        schema.properties[propName].id = pks[item.columnName];
      }
      const dbSpecific = schema.properties[propName][dbType] = {
        columnName: item.columnName,
        dataType: item.dataType,
        dataLength: item.dataLength,
        dataPrecision: item.dataPrecision,
        dataScale: item.dataScale,
        nullable: item.nullable,
      };
      // merge connector-specific properties
      if (item[dbType]) {
        for (const k in item[dbType]) {
          dbSpecific[k] = item[dbType][k];
        }
      }
    });

    // Add current modelName to the visited tables
    options.visited = options.visited || {};
    const schemaKey = columns[0].owner + '.' + tableName;
    if (!options.visited.hasOwnProperty(schemaKey)) {
      if (self.settings.debug) {
        debug('Adding schema for ' + schemaKey);
      }
      options.visited[schemaKey] = schema;
    }

    const otherTables = {};
    if (followingRelations) {
      // Handle foreign keys
      const fks = {};
      const foreignKeys = results[2] || [];
      foreignKeys.forEach(function(fk) {
        const fkInfo = {
          keySeq: fk.keySeq,
          owner: fk.pkOwner,
          tableName: fk.pkTableName,
          columnName: fk.pkColumnName,
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
      foreignKeys.forEach(function(fk) {
        const propName = nameMapper('fk', (fk.fkName || fk.pkTableName));
        schema.options.relations[propName] = {
          model: nameMapper('table', fk.pkTableName),
          type: 'belongsTo',
          foreignKey: nameMapper('column', fk.fkColumnName),
        };

        const key = fk.pkOwner + '.' + fk.pkTableName;
        if (!options.visited.hasOwnProperty(key) && !otherTables.hasOwnProperty(key)) {
          otherTables[key] = {owner: fk.pkOwner, tableName: fk.pkTableName};
        }
      });
    }

    if (Object.keys(otherTables).length === 0) {
      cb(null, options.visited);
    } else {
      const moreTasks = [];
      for (const t in otherTables) {
        if (self.settings.debug) {
          debug('Discovering related schema for ' + schemaKey);
        }
        const newOptions = {};
        for (const key in options) {
          newOptions[key] = options[key];
        }
        newOptions.owner = otherTables[t].owner;

        moreTasks.push(DataSource.prototype.discoverSchemas.bind(self, otherTables[t].tableName, newOptions));
      }
      async.parallel(moreTasks, function(err, results) {
        const result = results && results[0];
        cb(err, result);
      });
    }
  });
  return cb.promise;
};

/*! Method will be completely removed in LoopBack.next
*/
/**
 * Discover schema from a given table/view synchronously
 * @param {String} modelName The model name
 * @options {Object} [options] Options; see below.
 * @property {String} owner|schema Database owner or schema name.
 * @property {Boolean} relations True if relations (primary key/foreign key) are navigated; false otherwise.
 * @property {Boolean} all True if all owners are included; false otherwise.
 * @property {Boolean} views True if views are included; false otherwise.
 * @returns {Array<Object>} An array of schema definition objects.
 */
DataSource.prototype.discoverSchemasSync = function(modelName, options) {
  const self = this;
  const dbType = this.connector.name;

  const columns = this.discoverModelPropertiesSync(modelName, options);
  if (!columns || columns.length === 0) {
    return [];
  }

  const nameMapper = options.nameMapper || function mapName(type, name) {
    if (type === 'table' || type === 'model') {
      return fromDBName(name, false);
    } else {
      return fromDBName(name, true);
    }
  };

  // Handle primary keys
  const primaryKeys = this.discoverPrimaryKeysSync(modelName, options);
  const pks = {};
  primaryKeys.forEach(function(pk) {
    pks[pk.columnName] = pk.keySeq;
  });

  if (self.settings.debug) {
    debug('Primary keys: ', pks);
  }

  const schema = {
    name: nameMapper('table', modelName),
    options: {
      idInjection: false, // DO NOT add id property
    },
    properties: {},
  };

  schema.options[dbType] = {
    schema: columns.length > 0 && columns[0].owner,
    table: modelName,
  };

  columns.forEach(function(item) {
    const i = item;

    const propName = nameMapper('column', item.columnName);
    schema.properties[propName] = {
      type: item.type,
      required: (item.nullable === 'N'),
      length: item.dataLength,
      precision: item.dataPrecision,
      scale: item.dataScale,
    };

    if (pks[item.columnName]) {
      schema.properties[propName].id = pks[item.columnName];
    }
    schema.properties[propName][dbType] = {
      columnName: i.columnName,
      dataType: i.dataType,
      dataLength: i.dataLength,
      dataPrecision: item.dataPrecision,
      dataScale: item.dataScale,
      nullable: i.nullable,
    };
  });

  // Add current modelName to the visited tables
  options.visited = options.visited || {};
  const schemaKey = columns[0].owner + '.' + modelName;
  if (!options.visited.hasOwnProperty(schemaKey)) {
    if (self.settings.debug) {
      debug('Adding schema for ' + schemaKey);
    }
    options.visited[schemaKey] = schema;
  }

  const otherTables = {};
  const followingRelations = options.associations || options.relations;
  if (followingRelations) {
    // Handle foreign keys
    const fks = {};
    const foreignKeys = this.discoverForeignKeysSync(modelName, options);
    foreignKeys.forEach(function(fk) {
      const fkInfo = {
        keySeq: fk.keySeq,
        owner: fk.pkOwner,
        tableName: fk.pkTableName,
        columnName: fk.pkColumnName,
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
    foreignKeys.forEach(function(fk) {
      const propName = nameMapper('column', fk.pkTableName);
      schema.options.relations[propName] = {
        model: nameMapper('table', fk.pkTableName),
        type: 'belongsTo',
        foreignKey: nameMapper('column', fk.fkColumnName),
      };

      const key = fk.pkOwner + '.' + fk.pkTableName;
      if (!options.visited.hasOwnProperty(key) && !otherTables.hasOwnProperty(key)) {
        otherTables[key] = {owner: fk.pkOwner, tableName: fk.pkTableName};
      }
    });
  }

  if (Object.keys(otherTables).length === 0) {
    return options.visited;
  } else {
    const moreTasks = [];
    for (const t in otherTables) {
      if (self.settings.debug) {
        debug('Discovering related schema for ' + schemaKey);
      }
      const newOptions = {};
      for (const key in options) {
        newOptions[key] = options[key];
      }
      newOptions.owner = otherTables[t].owner;
      self.discoverSchemasSync(otherTables[t].tableName, newOptions);
    }
    return options.visited;
  }
};

/**
 * Discover and build models from the specified owner/modelName.
 *
 * @param {String} modelName The model name.
 * @options {Object} [options] Options; see below.
 * @property {String} owner|schema Database owner or schema name.
 * @property {Boolean} relations True if relations (primary key/foreign key) are navigated; false otherwise.
 * @property {Boolean} all True if all owners are included; false otherwise.
 * @property {Boolean} views True if views are included; false otherwise.
 * @param {Function} [cb] The callback function
 * @returns {Promise} A Promise object that resolves with a map of model
 * constructors, keyed by model name
 */
DataSource.prototype.discoverAndBuildModels = function(modelName, options, cb) {
  const self = this;
  options = options || {};
  this.discoverSchemas(modelName, options, function(err, schemas) {
    if (err) {
      cb && cb(err, schemas);
      return;
    }

    const schemaList = [];
    for (const s in schemas) {
      const schema = schemas[s];
      if (options.base) {
        schema.options = schema.options || {};
        schema.options.base = options.base;
      }
      schemaList.push(schema);
    }

    const models = self.modelBuilder.buildModels(schemaList,
      self.createModel.bind(self));

    cb && cb(err, models);
  });
};

/*! Method will be completely removed in LoopBack.next
*/
/**
 * Discover and build models from the given owner/modelName synchronously.
 * @param {String} modelName The model name.
 * @options {Object} [options] Options; see below.
 * @property {String} owner|schema Database owner or schema name.
 * @property {Boolean} relations True if relations (primary key/foreign key) are navigated; false otherwise.
 * @property {Boolean} all True if all owners are included; false otherwise.
 * @property {Boolean} views True if views are included; false otherwise.

 * @param {String} modelName The model name
 * @param {Object} [options] The options
 * @returns {Object} A map of model constructors, keyed by model name
 */
DataSource.prototype.discoverAndBuildModelsSync = function(modelName, options) {
  options = options || {};
  const schemas = this.discoverSchemasSync(modelName, options);

  const schemaList = [];
  for (const s in schemas) {
    const schema = schemas[s];
    if (options.base) {
      schema.options = schema.options || {};
      schema.options.base = options.base;
    }
    schemaList.push(schema);
  }

  const models = this.modelBuilder.buildModels(schemaList,
    this.createModel.bind(this));

  return models;
};

/**
 * Introspect a JSON object and build a model class
 * @param {String} name Name of the model
 * @param {Object} json The json object representing a model instance
 * @param {Object} options Options
 * @returns {Model} A Model class
 */
DataSource.prototype.buildModelFromInstance = function(name, json, options) {
  // Introspect the JSON document to generate a schema
  const schema = ModelBuilder.introspect(json);

  // Create a model for the generated schema
  return this.createModel(name, schema, options);
};

/**
 * Check whether or not migrations are required for the database schema to match
 * the Model definitions attached to the DataSource.
 * Note: This method applies only to SQL connectors.
 * @param {String|String[]} [models] A model name or an array of model names. If not present, apply to all models.
 * @returns {Boolean} Whether or not migrations are required.
 */
DataSource.prototype.isActual = function(models, cb) {
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
 * schema logs, use `dataSource.on('log', ...)` emitter event
 *
 * @private used by connectors
 */
DataSource.prototype.log = function(sql, t) {
  debug(sql, t);
  this.emit('log', sql, t);
};

/**
 * Freeze dataSource. Behavior depends on connector
 * To continuously add artifacts to datasource until it is frozen, but it is not really used in loopback.
 */
DataSource.prototype.freeze = function freeze() {
  if (!this.connector) {
    throw new Error(g.f('The connector has not been initialized.'));
  }
  if (this.connector.freezeDataSource) {
    this.connector.freezeDataSource();
  }
  if (this.connector.freezeSchema) {
    this.connector.freezeSchema();
  }
};

/**
 * Return table name for specified `modelName`.
 * @param {String} modelName The model name.
 * @returns {String} The table name.
 */
DataSource.prototype.tableName = function(modelName) {
  return this.getModelDefinition(modelName).tableName(this.connector.name);
};

/**
 * Return column name for specified modelName and propertyName
 * @param {String} modelName The model name
 * @param {String} propertyName The property name
 * @returns {String} columnName The column name.
 */
DataSource.prototype.columnName = function(modelName, propertyName) {
  return this.getModelDefinition(modelName).columnName(this.connector.name, propertyName);
};

/**
 * Return column metadata for specified modelName and propertyName
 * @param {String} modelName The model name
 * @param {String} propertyName The property name
 * @returns {Object} column metadata
 */
DataSource.prototype.columnMetadata = function(modelName, propertyName) {
  return this.getModelDefinition(modelName).columnMetadata(this.connector.name, propertyName);
};

/**
 * Return column names for specified modelName
 * @param {String} modelName The model name
 * @returns {String[]} column names
 */
DataSource.prototype.columnNames = function(modelName) {
  return this.getModelDefinition(modelName).columnNames(this.connector.name);
};

/**
 * Find the ID column name
 * @param {String} modelName The model name
 * @returns {String} columnName for ID
 */
DataSource.prototype.idColumnName = function(modelName) {
  return this.getModelDefinition(modelName).idColumnName(this.connector.name);
};

/**
 * Find the ID property name
 * @param {String} modelName The model name
 * @returns {String} property name for ID
 */
DataSource.prototype.idName = function(modelName) {
  if (!this.getModelDefinition(modelName).idName) {
    g.error('No {{id}} name %s', this.getModelDefinition(modelName));
  }
  return this.getModelDefinition(modelName).idName();
};

/**
 * Find the ID property names sorted by the index
 * @param {String} modelName The model name
 * @returns {String[]} property names for IDs
 */
DataSource.prototype.idNames = function(modelName) {
  return this.getModelDefinition(modelName).idNames();
};

/**
 * Find the id property definition
 * @param {String} modelName The model name
 * @returns {Object} The id property definition
 */
DataSource.prototype.idProperty = function(modelName) {
  const def = this.getModelDefinition(modelName);
  const idProps = def && def.ids();
  return idProps && idProps[0] && idProps[0].property;
};

/**
 * Define foreign key to another model
 * @param {String} className The model name that owns the key
 * @param {String} key Name of key field
 * @param {String} foreignClassName The foreign model name
 * @param {String} pkName (optional) primary key used for foreignKey
 */
DataSource.prototype.defineForeignKey = function defineForeignKey(className, key, foreignClassName, pkName) {
  let pkType = null;
  const foreignModel = this.getModelDefinition(foreignClassName);
  pkName = pkName || foreignModel && foreignModel.idName();
  if (pkName) {
    pkType = foreignModel.properties[pkName].type;
  }
  const model = this.getModelDefinition(className);
  if (model.properties[key]) {
    if (pkType) {
      // Reset the type of the foreign key
      model.rawProperties[key].type = model.properties[key].type = pkType;
    }
    return;
  }

  const fkDef = {type: pkType};
  const foreignMeta = this.columnMetadata(foreignClassName, pkName);
  if (foreignMeta && (foreignMeta.dataType || foreignMeta.dataLength)) {
    fkDef[this.connector.name] = {};
    if (foreignMeta.dataType) {
      fkDef[this.connector.name].dataType = foreignMeta.dataType;
    }
    if (foreignMeta.dataLength) {
      fkDef[this.connector.name].dataLength = foreignMeta.dataLength;
    }
  }
  if (this.connector.defineForeignKey) {
    const cb = function(err, keyType) {
      if (err) throw err;
      fkDef.type = keyType || pkType;
      // Add the foreign key property to the data source _models
      this.defineProperty(className, key, fkDef);
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
    this.defineProperty(className, key, fkDef);
  }
};

/**
 * Close connection to the DataSource.
 * @param {Function} [cb] The callback function. Optional.
 */
DataSource.prototype.disconnect = function disconnect(cb) {
  cb = cb || utils.createPromiseCallback();
  const self = this;
  if (this.connected && (typeof this.connector.disconnect === 'function')) {
    this.connector.disconnect(function(err, result) {
      self.connected = false;
      cb && cb(err, result);
    });
  } else {
    process.nextTick(function() {
      self.connected = false;
      cb && cb();
    });
  }
  return cb.promise;
};

/**
 * Copy the model from Master.
 * @param {Function} Master The model constructor
 * @returns {Model} A copy of the Model object constructor
 *
 * @private
 */
DataSource.prototype.copyModel = function copyModel(Master) {
  const dataSource = this;
  const className = Master.modelName;
  const md = Master.modelBuilder.getModelDefinition(className);
  const Slave = function SlaveModel() {
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
    dataSource.modelBuilder.definitions[className] =
      new ModelDefinition(dataSource.modelBuilder, md.name, md.properties, md.settings);

    if ((!dataSource.isTransaction) && dataSource.connector && dataSource.connector.define) {
      dataSource.connector.define({
        model: Slave,
        properties: md.properties,
        settings: md.settings,
      });
    }
  }

  return Slave;
};

/**
 * Run a transaction against the DataSource.
 *
 * This method can be used in different ways based on the passed arguments and
 * type of underlying data source:
 *
 * If no `execute()` function is provided and the underlying DataSource is a
 * database that supports transactions, a Promise is returned that resolves to
 * an EventEmitter representing the transaction once it is ready.
 * `transaction.models` can be used to receive versions of the DataSource's
 * model classes which are bound to the created transaction, so that all their
 * database methods automatically use the transaction. At the end of all
 * database transactions, `transaction.commit()` can be called to commit the
 * transactions, or `transaction.rollback()` to roll them back.
 *
 * If no `execute()` function is provided on a transient or memory DataSource,
 * the EventEmitter representing the transaction is returned immediately. For
 * backward compatibility, this object also supports `transaction.exec()`
 * instead of `transaction.commit()`, and calling `transaction.rollback()` is
 * not required on such transient and memory DataSource instances.
 *
 * If an `execute()` function is provided, then it is called as soon as the
 * transaction is ready, receiving `transaction.models` as its first
 * argument. `transaction.commit()` and `transaction.rollback()` are then
 * automatically called at the end of `execute()`, based on whether exceptions
 * happen during execution or not. If no callback is provided to be called at
 * the end of the execution, a Promise object is returned that is resolved or
 * rejected as soon as the execution is completed, and the transaction is
 * committed or rolled back.
 *
 * @param {Function} execute The execute function, called with (models). Note
 *     that the instances in `models` are bound to the created transaction, and
 *     are therefore not identical with the models in `app.models`, but slaves
 *     thereof (optional).
 * @options {Object} options The options to be passed to `beginTransaction()`
 *     when creating the transaction on database sources (optional).
 * @param {Function} cb Callback called with (err)
 * @returns {Promise | EventEmitter}
 */
DataSource.prototype.transaction = function(execute, options, cb) {
  if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = {};
  } else {
    options = options || {};
  }

  const dataSource = this;
  const transaction = new EventEmitter();

  for (const p in dataSource) {
    transaction[p] = dataSource[p];
  }

  transaction.isTransaction = true;
  transaction.origin = dataSource;
  transaction.connected = false;
  transaction.connecting = false;

  // Don't allow creating transactions on a transaction data-source:
  transaction.transaction = function() {
    throw new Error(g.f('Nesting transactions is not supported'));
  };

  // Create a blank pool for the slave models bound to this transaction.
  const modelBuilder = new ModelBuilder();
  const slaveModels = modelBuilder.models;
  transaction.modelBuilder = modelBuilder;
  transaction.models = slaveModels;
  transaction.definitions = modelBuilder.definitions;

  // For performance reasons, use a getter per model and only call copyModel()
  // for the models that are actually used. These getters are then replaced
  // with the actual values on first use.
  const masterModels = dataSource.modelBuilder.models;
  Object.keys(masterModels).forEach(function(name) {
    Object.defineProperty(slaveModels, name, {
      enumerable: true,
      configurable: true,
      get: function() {
        // Delete getter so copyModel() can redefine slaveModels[name].
        // NOTE: No need to set the new value as copyModel() takes care of it.
        delete slaveModels[name];
        return dataSource.copyModel.call(transaction, masterModels[name]);
      },
    });
  });

  let done = function(err) {
    if (err) {
      transaction.rollback(function(error) {
        cb(err || error);
      });
    } else {
      transaction.commit(cb);
    }
    // Make sure cb() isn't called twice, e.g. if `execute` returns a
    // thenable object and also calls the passed `cb` function.
    done = function() {};
  };

  function handleExecute() {
    if (execute) {
      cb = cb || utils.createPromiseCallback();
      try {
        const result = execute(slaveModels, done);
        if (result && typeof result.then === 'function') {
          result.then(function() { done(); }, done);
        }
      } catch (err) {
        done(err);
      }
      return cb.promise;
    } else if (cb) {
      cb(null, transaction);
    } else {
      return transaction;
    }
  }

  function transactionCreated(err, tx) {
    if (err) {
      cb(err);
    } else {
      // Expose transaction on the created transaction dataSource so it can be
      // retrieved again in determineOptions() in dao.js, as well as referenced
      // in transaction.commit() and transaction.rollback() below.
      transaction.currentTransaction = tx;

      // Some connectors like Postgresql expose loobpack-connector as a property on the tx
      if (!tx.observe && tx.connector) {
        tx = tx.connector;
      }
      // Handle timeout and pass it on as an error.
      tx.observe('timeout', function(context, next) {
        const err = new Error(g.f('Transaction is rolled back due to timeout'));
        err.code = 'TRANSACTION_TIMEOUT';
        // Pass on the error to next(), so that the final 'timeout' observer in
        // loopback-connector does not trigger a rollback by itself that we
        // can't get a callback for when it's finished.
        next(err);
        // Call done(err) after, to execute the rollback here and reject the
        // promise with the error when it's completed.
        done(err);
      });
      handleExecute();
    }
  }

  function ensureTransaction(transaction, cb) {
    if (!transaction) {
      process.nextTick(function() {
        cb(new Error(g.f(
          'Transaction is not ready, wait for the returned promise to resolve'
        )));
      });
    }
    return transaction;
  }

  const connector = dataSource.connector;
  if (connector.transaction) {
    // Create a transient or memory source transaction.
    transaction.connector = connector.transaction();
    transaction.commit =
    transaction.exec = function(cb) {
      this.connector.exec(cb);
    };
    transaction.rollback = function(cb) {
      // No need to do anything here.
      cb();
    };
    return handleExecute();
  } else if (connector.beginTransaction) {
    // Create a database source transaction.
    transaction.exec =
    transaction.commit = function(cb) {
      ensureTransaction(this.currentTransaction, cb).commit(cb);
    };
    transaction.rollback = function(cb) {
      ensureTransaction(this.currentTransaction, cb).rollback(cb);
    };
    // Always use callback / promise due to the use of beginTransaction()
    cb = cb || utils.createPromiseCallback();
    Transaction.begin(connector, options, transactionCreated);
    return cb.promise;
  } else {
    throw new Error(g.f('DataSource does not support transactions'));
  }
};

/**
 * Enable remote access to a data source operation. Each [connector](#connector) has its own set of set
 * remotely enabled and disabled operations. To list the operations, call `dataSource.operations()`.
 * @param {String} operation The operation name
 */

DataSource.prototype.enableRemote = function(operation) {
  const op = this.getOperation(operation);
  if (op) {
    op.remoteEnabled = true;
  } else {
    throw new Error(g.f('%s is not provided by the attached connector', operation));
  }
};

/**
 * Disable remote access to a data source operation. Each [connector](#connector) has its own set of set enabled
 * and disabled operations. To list the operations, call `dataSource.operations()`.
 *
 *```js
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
 * - Disabling the remoting for a method only affects client access (it will still be available from server models).
 * - Data sources must enable / disable operations before attaching or creating models.
 * @param {String} operation The operation name
 */

DataSource.prototype.disableRemote = function(operation) {
  const op = this.getOperation(operation);
  if (op) {
    op.remoteEnabled = false;
  } else {
    throw new Error(g.f('%s is not provided by the attached connector', operation));
  }
};

/**
 * Get an operation's metadata.
 * @param {String} operation The operation name
 */

DataSource.prototype.getOperation = function(operation) {
  const ops = this.operations();
  const opKeys = Object.keys(ops);

  for (let i = 0; i < opKeys.length; i++) {
    const op = ops[opKeys[i]];

    if (op.name === operation) {
      return op;
    }
  }
};

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
DataSource.prototype.operations = function() {
  return this._operations;
};

/**
 * Define an operation to the data source
 * @param {String} name The operation name
 * @param {Object} options The options
 * @param {Function} fn The function
 */
DataSource.prototype.defineOperation = function(name, options, fn) {
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
 * Check if the data source is connected. If not, the method invocation will be
 * deferred and queued.
 *
 *
 * @param {Object} obj  Receiver for the method call
 * @param {Object} args  Arguments passing to the method call
 * @returns - a Boolean value to indicate if the method invocation is deferred.
 * false: The datasource is already connected
 * - true: The datasource is yet to be connected
 */
DataSource.prototype.queueInvocation = DataSource.prototype.ready =
function(obj, args) {
  const self = this;
  debug('Datasource %s: connected=%s connecting=%s', this.name,
    this.connected, this.connecting);
  if (this.connected) {
    // Connected
    return false;
  }

  const method = args.callee;
  // Set up a callback after the connection is established to continue the method call

  let onConnected = null, onError = null, timeoutHandle = null;
  onConnected = function() {
    debug('Datasource %s is now connected - executing method %s', self.name, method.name);
    // Remove the error handler
    self.removeListener('error', onError);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    const params = [].slice.call(args);
    try {
      method.apply(obj, params);
    } catch (err) {
      // Catch the exception and report it via callback
      const cb = params.pop();
      if (typeof cb === 'function') {
        process.nextTick(function() {
          cb(err);
        });
      } else {
        throw err;
      }
    }
  };
  onError = function(err) {
    debug('Datasource %s fails to connect - aborting method %s', self.name, method.name);
    // Remove the connected listener
    self.removeListener('connected', onConnected);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    const params = [].slice.call(args);
    const cb = params.pop();
    if (typeof cb === 'function') {
      process.nextTick(function() {
        cb(err);
      });
    }
  };
  this.once('connected', onConnected);
  this.once('error', onError);

  // Set up a timeout to cancel the invocation
  const timeout = this.settings.connectionTimeout || 5000;
  timeoutHandle = setTimeout(function() {
    debug('Datasource %s fails to connect due to timeout - aborting method %s',
      self.name, method.name);
    self.connecting = false;
    self.removeListener('error', onError);
    self.removeListener('connected', onConnected);
    const params = [].slice.call(args);
    const cb = params.pop();
    if (typeof cb === 'function') {
      cb(new Error(g.f('Timeout in connecting after %s ms', timeout)));
    }
  }, timeout);

  if (!this.connecting) {
    debug('Connecting datasource %s to connector %s', this.name, this.connector.name);
    this.connect();
  }
  return true;
};

/**
 * Ping the underlying connector to test the connections
 * @param {Function} [cb] Callback function
 */
DataSource.prototype.ping = function(cb) {
  cb = cb || utils.createPromiseCallback();
  const self = this;
  if (self.connector.ping) {
    this.connector.ping(cb);
  } else if (self.connector.discoverModelProperties) {
    self.discoverModelProperties('dummy', {}, cb);
  } else {
    process.nextTick(function() {
      const err = self.connected ? null : new Error(g.f('Not connected'));
      cb(err);
    });
  }
  return cb.promise;
};

/**
 * Execute an arbitrary command. The commands are connector specific,
 * please refer to the documentation of your connector for more details.
 *
 * @param command String|Object The command to execute, e.g. an SQL query.
 * @param [args] Array Parameters values to set in the command.
 * @param [options] Object Additional options, e.g. the transaction to use.
 * @returns Promise A promise of the result
 */
DataSource.prototype.execute = function(command, args = [], options = {}) {
  assert(typeof command === 'string' || typeof command === 'object',
    '"command" must be a string or an object.');
  assert(typeof args === 'object',
    '"args" must be an object, an array or undefined.');
  assert(typeof options === 'object',
    '"options" must be an object or undefined.');

  if (!this.connector) {
    return Promise.reject(errorNotImplemented(
      `DataSource "${this.name}" is missing a connector to execute the command.`
    ));
  }

  if (!this.connector.execute) {
    return Promise.reject(new errorNotImplemented(
      `The connector "${this.connector.name}" used by dataSource "${this.name}" ` +
      'does not implement "execute()" API.'
    ));
  }

  return new Promise((resolve, reject) => {
    this.connector.execute(command, args, options, onExecuted);
    function onExecuted(err, result) {
      if (err) return reject(err);
      if (arguments.length > 2) {
        result = Array.prototype.slice.call(arguments, 1);
      }
      resolve(result);
    }
  });

  function errorNotImplemented(msg) {
    const err = new Error(msg);
    err.code = 'NOT_IMPLEMENTED';
    return err;
  }
};

/*! The hidden property call is too expensive so it is not used that much
*/
/**
 * Define a hidden property
 * It is an utility to define a property to the Object with info flags
 * @param {Object} obj The property owner
 * @param {String} key The property name
 * @param {Mixed} value The default value
 */
function hiddenProperty(obj, key, value) {
  Object.defineProperty(obj, key, {
    writable: false,
    enumerable: false,
    configurable: false,
    value: value,
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
    value: value,
  });
}

// Carry over a few properties/methods from the ModelBuilder as some tests use them
DataSource.Text = ModelBuilder.Text;
DataSource.JSON = ModelBuilder.JSON;
DataSource.Any = ModelBuilder.Any;
