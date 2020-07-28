// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {AnyObject, Callback, Options} from './common';
import {Connector} from './connector';
import {
  ModelBaseClass,
  ModelBuilder,
  ModelDefinition,
  PropertyDefinition
} from './model';
import {EventEmitter} from 'events';
import {IsolationLevel, Transaction} from './transaction-mixin';

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
export declare class DataSource extends EventEmitter {
  name: string;
  settings: Options;

  initialized?: boolean;
  connected?: boolean;
  connecting?: boolean;

  connector?: Connector;

  definitions: {[modelName: string]: ModelDefinition};

  DataAccessObject: AnyObject & {prototype: AnyObject};

  constructor(name: string, settings?: Options, modelBuilder?: ModelBuilder);

  constructor(settings?: Options, modelBuilder?: ModelBuilder);

  constructor(
    connectorModule: Connector,
    settings?: Options,
    modelBuilder?: ModelBuilder,
  );

  /**
   * Create a model class
   * @param name Name of the model
   * @param properties An object of property definitions
   * @param options Options for model settings
   */
  createModel<T extends ModelBaseClass>(
    name: string,
    properties?: AnyObject,
    options?: Options,
  ): T;

  /**
   * Look up a model class by name
   * @param modelName Model name
   * @param forceCreate A flag to force creation of a model if not found
   */
  getModel(
    modelName: string,
    forceCreate?: boolean,
  ): ModelBaseClass | undefined;

  /**
   * Remove a model from the registry.
   *
   * @param modelName
   */
  deleteModelByName(modelName: string): void;

  /**
   * Remove all models from the registry, but keep the connector instance
   * (including the pool of database connections).
   */
  deleteAllModels(): void;

  /**
   * Attach an existing model to a data source.
   * This will mixin all of the data access object functions (DAO) into your
   * modelClass definition.
   * @param {ModelBaseClass} modelClass The model constructor that will be enhanced
   * by DataAccessObject mixins.
   */
  attach(modelClass: ModelBaseClass): ModelBaseClass;

  automigrate(models?: string | string[]): Promise<void>;
  // legacy callback style
  automigrate(models: string | string[] | undefined, callback: Callback): void;

  autoupdate(models?: string | string[]): Promise<void>;
  // legacy callback style
  autoupdate(models: string | string[] | undefined, callback: Callback): void;

  discoverModelDefinitions(
    options?: Options,
  ): Promise<ModelDefinition[]>;
  // legacy callback style (no options)
  discoverModelDefinitions(
    callback: Callback<ModelDefinition[]>,
  ): void;
  // legacy callback style (with options)
  discoverModelDefinitions(
    options: Options,
    callback: Callback<ModelDefinition[]>,
  ): void;

  discoverModelProperties(
    modelName: string,
    options?: Options,
  ): Promise<PropertyDefinition[]>;
  // legacy callback style (no options)
  discoverModelProperties(
    modelName: string,
    callback: Callback<PropertyDefinition[]>,
  ): void;
  // legacy callback style (with options)
  discoverModelProperties(
    modelName: string,
    options: Options,
    callback: Callback<PropertyDefinition[]>,
  ): void;

  discoverPrimaryKeys(
    modelName: string,
    options?: Options,
  ): Promise<PropertyDefinition[]>;
  // legacy callback style (no options)
  discoverPrimaryKeys(
    modelName: string,
    callback: Callback<PropertyDefinition[]>,
  ): void;
  // legacy callback style (with options)
  discoverPrimaryKeys(
    modelName: string,
    options: Options,
    callback: Callback<PropertyDefinition[]>,
  ): void;

  discoverForeignKeys(
    modelName: string,
    options?: Options,
  ): Promise<PropertyDefinition[]>;
  // legacy callback style (no options)
  discoverForeignKeys(
    modelName: string,
    callback: Callback<PropertyDefinition[]>,
  ): void;
  // legacy callback style (with options)
  discoverForeignKeys(
    modelName: string,
    options: Options,
    callback: Callback<PropertyDefinition[]>,
  ): void;

  discoverExportedForeignKeys(
    modelName: string,
    options?: Options,
  ): Promise<PropertyDefinition[]>;
  // legacy callback style (no options)
  discoverExportedForeignKeys(
    modelName: string,
    callback: Callback<PropertyDefinition[]>,
  ): void;
  // legacy callback style (with options)
  discoverExportedForeignKeys(
    modelName: string,
    options: Options,
    callback: Callback<PropertyDefinition[]>,
  ): void;

  discoverAndBuildModels(
    modelName: string,
    options?: Options,
  ): Promise<{[name: string]: ModelBaseClass}>;
  // legacy callback style (no options)
  discoverAndBuildModels(
    modelName: string,
    callback: Callback<{[name: string]: ModelBaseClass}>,
  ): void;
  // legacy callback style (with options)
  discoverAndBuildModels(
    modelName: string,
    options: Options,
    callback: Callback<{[name: string]: ModelBaseClass}>,
  ): void;

  discoverSchema(
    tableName: string,
    options?: Options,
  ): Promise<AnyObject>;
  // legacy callback style (no options)
  discoverSchema(
    tableName: string,
    callback: Callback<AnyObject>,
  ): void;
  // legacy callback style (with options)
  discoverSchema(
    tableName: string,
    options: Options,
    callback: Callback<AnyObject>,
  ): void;

  discoverSchemas(
    tableName: string,
    options?: Options,
  ): Promise<AnyObject[]>;
  // legacy callback style (no options)
  discoverSchemas(
    tableName: string,
    callback: Callback<AnyObject[]>,
  ): void;
  // legacy callback style (with options)
  discoverSchemas(
    tableName: string,
    options: Options,
    callback: Callback<AnyObject[]>,
  ): void;

  buildModelFromInstance(
    modelName: string,
    jsonObject: AnyObject,
    options?: Options,
  ): ModelBaseClass;

  connect(): Promise<void>;
  // legacy callback style
  connect(callback: Callback): void;

  disconnect(): Promise<void>;
  // legacy callback style
  disconnect(callback: Callback): void;

  // Only promise variant, callback is intentionally not described.
  // Note we must use `void | PromiseLike<void>` to avoid breaking
  // existing LoopBack 4 applications.
  // TODO(semver-major): change the return type to `Promise<void>`
  stop(): void | PromiseLike<void>;

  ping(): Promise<void>;
  // legacy callback style
  ping(callback: Callback): void;

  // Only promise variant, callback is intentionally not supported.

  /**
   * Execute a SQL command.
   *
   * **WARNING:** In general, it is always better to perform database actions
   * through repository methods. Directly executing SQL may lead to unexpected
   * results, corrupted data, security vulnerabilities and other issues.
   *
   * @example
   *
   * ```ts
   * // MySQL
   * const result = await db.execute(
   *   'SELECT * FROM Products WHERE size > ?',
   *   [42]
   * );
   *
   * // PostgreSQL
   * const result = await db.execute(
   *   'SELECT * FROM Products WHERE size > $1',
   *   [42]
   * );
   * ```
   *
   * @param command A parameterized SQL command or query.
   * Check your database documentation for information on which characters to
   * use as parameter placeholders.
   * @param parameters List of parameter values to use.
   * @param options Additional options, for example `transaction`.
   * @returns A promise which resolves to the command output as returned by the
   * database driver. The output type (data structure) is database specific and
   * often depends on the command executed.
   */
  execute(
    command: string | object,
    parameters?: any[] | object,
    options?: Options,
  ): Promise<any>;

  /**
   * Execute a MongoDB command.
   *
   * **WARNING:** In general, it is always better to perform database actions
   * through repository methods. Directly executing MongoDB commands may lead
   * to unexpected results and other issues.
   *
   * @example
   *
   * ```ts
   * const result = await db.execute('MyCollection', 'aggregate', [
   *   {$lookup: {
   *     // ...
   *   }},
   *   {$unwind: '$data'},
   *   {$out: 'tempData'}
   * ]);
   * ```
   *
   * @param collectionName The name of the collection to execute the command on.
   * @param command The command name. See
   * [Collection API docs](http://mongodb.github.io/node-mongodb-native/3.6/api/Collection.html)
   * for the list of commands supported by the MongoDB client.
   * @param parameters Command parameters (arguments), as described in MongoDB API
   * docs for individual collection methods.
   * @returns A promise which resolves to the command output as returned by the
   * database driver.
   */
  execute(
    collectionName: string,
    command: string,
    ...parameters: any[],
  ): Promise<any>;

  /**
   * Execute a raw database command using a connector that's not described
   * by LoopBack's `execute` API yet.
   *
   * **WARNING:** In general, it is always better to perform database actions
   * through repository methods. Directly executing database commands may lead
   * to unexpected results and other issues.
   *
   * @param args Command and parameters, please consult your connector's
   * documentation to learn about supported commands and their parameters.
   * @returns A promise which resolves to the command output as returned by the
   * database driver.
   */
  execute(...args: any[]): Promise<any>;

  /**
   * Begin a new transaction.
   *
   *
   * @param [options] Options {isolationLevel: '...', timeout: 1000}
   * @returns Promise A promise which resolves to a Transaction object
   */
  beginTransaction(options?: IsolationLevel | Options): Promise<Transaction>;
}
