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
import { ColumnMetadata, ConnectorSettings, ModelBase, ModelSettings } from '..';

export type OperationOptions = {
  accepts: string[],
  returns: string[],
  http: object,
  remoteEnabled: boolean,
  scope: unknown,
  fnName: string,
}

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
  settings: ConnectorSettings;

  initialized?: boolean;
  connected?: boolean;
  connecting?: boolean;
  
  /**
   * {@inheritDoc DataSource.connector}
   * @deprecated Use {@link DataSource.connector} instead.
   */
  adapter?: Connector;

  /**
   * Connector instance.
   */
  connector?: Connector;

  modelBuilder: ModelBuilder;

  models: Record<string, typeof ModelBase>;
  
  definitions: {[modelName: string]: ModelDefinition};
  
  DataAccessObject: AnyObject & {prototype: AnyObject};
  
  pendingConnectCallbacks?: Callback[];

  /**
   * Log benchmarked message.
   * 
   * @remarks
   * This property is assigned to the defined to the attached connector's
   * {@link Connector.log | log} class member.
   * 
   * @param sql 
   * @param t Start time 
   */
  private log(sql: string, t: number): void;

  private _queuedInvocations: number;

  private _operations: Record<string, OperationOptions>;

  operations(): Record<string, OperationOptions>;

  defineOperation(name: string, options: OperationOptions, fn: Function): void;
  
  enableRemote(operation: string): void;

  disableRemote(operation: string): void;

  /**
   * Default global maximum number of event listeners.
   * 
   * @remarks
   * This default can be overriden through
   * {@link ConnectorSettings.maxOfflineRequests}.
   */
  static DEFAULT_MAX_OFFLINE_REQUESTS: number;

  /**
   * A hash-map of the different relation types.
   */
  static relationTypes: Record<string, string>;

  constructor(name: string, settings?: ConnectorSettings, modelBuilder?: ModelBuilder);

  constructor(settings?: ConnectorSettings, modelBuilder?: ModelBuilder);

  constructor(
    connectorModule: Connector,
    settings?: ConnectorSettings,
    modelBuilder?: ModelBuilder,
  );

  private setup(dsName: string, settings: ConnectorSettings): void;
  private setup(settings: ConnectorSettings): void;

  private _setupConnector();

  /**
   * Get the maximum number of event listeners
   * 
   * @remarks
   * Defaults to {@link DataSource.DEFAULT_MAX_OFFLINE_REQUESTS} if not explicitly
   * configured in {@link ConnectorSettings.maxOfflineRequests}.
   */
  getMaxOfflineRequests(): number;

  // Reason for deprecation is not clear.
  /**
   * {@inheritDoc Connector.getTypes}
   * @deprecated
   */
  getTypes(): string[];

  /**
   * Check if the datasource supports the specified types.
   * @param types Type name(s) to check against
   */
  supportTypes(types: string | string[]): boolean;

  /**
   * Returns if the attached connector is relational.
   * 
   * @returns If the attached connector is relational; `undefined` if no
   * connector is attached.
   */
  isRelational(): boolean | undefined;

  freeze(): void;

  /**
   * Return the table name for the specified `modelName`.
   * 
   * @param modelName Target model name
   * @returns The table name
   */
  tableName(modelName: string): string;

  /**
   * Retrieve the column name for the specified `modelName` and `propertyName`.
   * 
   * @param modelName Target model name
   * @param propertyName Target property name
   * @returns The column name
   */
  columnName(modelName: string, propertyName: string): string;

  /**
   * Retrieve the column names for the specified `modelName`.
   * 
   * @param modelName Target model name
   * @returns Column names
   */
  columnNames(modelName: string): string;

  /**
   * Retrieve coulmn metadata for the specified `modelName` and `propertyName`.
   * 
   * @param modelName Target model name
   * @param propertyName Target property name
   * @returns Column metadata
   */
  columnMetadata(modelName: string, propertyName: string): ColumnMetadata;

  /**
   * Retrieve the ID property name for a model.
   * 
   * @param modelName Target model name
   * @returns ID property name
   */
  idName(modelName: string): string;

  /**
   * Retrieve the ID property names sorted by their index.
   * 
   * @param modelName Target model name
   * @returns Property names for IDs
   */
  idNames(modelName: string): string[];

  /**
   * Retrieve the ID property definition.
   * 
   * @param modelName Target model name
   * @returns The ID property definition
   */
  idProperty(modelName: string): PropertyDefinition;

  /**
   * Define a foreign key to another model.
   * 
   * @param className The model name that owns the key
   * @param key Name of key field
   * @param foreignClassName Foreign model name
   * @param pkName Primary key used for foreign key
   */
  defineForeignKey(className: string, key: string, foreignClassName: string, pkName?: string): undefined | void;

  /**
   * Create a model class
   * @param name Name of the model
   * @param properties An object of property definitions
   * @param options Options for model settings
   */
  createModel<T extends ModelBaseClass>(
    name: string,
    properties?: AnyObject,
    options?: ModelSettings,
  ): T;

  /**
   * {@inheritDoc DataSource.createModel}
   * @deprecated Use {@link DataSource.createModel} instead
   */
  define: DataSource['createModel'];

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
   * 
   * @remarks
   * This will mixin all of the data access object functions (DAO) into your
   * modelClass definition.
   * 
   * @param modelClass The model constructor that will be
   * enhanced by DataAccessObject mixins.
   */
  attach(modelClass: ModelBaseClass): ModelBaseClass;

  automigrate(models?: string | string[]): Promise<void>;
  // legacy callback style
  automigrate(models: string | string[] | undefined, callback: Callback): void;

  autoupdate(models?: string | string[]): Promise<void>;
  // legacy callback style
  autoupdate(models: string | string[] | undefined, callback: Callback): void;

  /**
   * {@inheritDoc Connector.discoverModelDefinitions}
   */
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

  /**
   * {@inheritDoc Connector.discoverModelProperties}
   */
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

  /**
   * {@inheritDoc Connector.discoverPrimaryKeys}
   */
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

  /**
   * {@inheritDoc Connector.discoverForeignKeys}
   */
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

  /**
   * {@inheritDoc Connector.discoverExportedForeignKeys}
   */
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

  /**
   * {@inheritDoc Connector.discoverSchemas}
   */
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

  /**
   * Connect to the DataSource.
   */
  connect(): Promise<void>;
  // legacy callback style
  connect(callback: Callback): void;

  /**
   * Close the connection to the DataSource.
   */
  disconnect(): Promise<void>;
  // legacy callback style
  disconnect(callback: Callback): void;

  // Only promise variant, callback is intentionally not described.
  // Note we must use `void | PromiseLike<void>` to avoid breaking
  // existing LoopBack 4 applications.
  // TODO(semver-major): change the return type to `Promise<void>`
  /**
   * An alias for {@link DataSource.disconnect} to allow this datasource to be
   * an LB4 life-cycle observer
   * 
   * @remarks
   * A `.start()` equivalent was deliberately not provided as the logic for
   * establishing connection(s) is more complex and is usually statred
   * immediately from the datasource constructor.
   */
  stop(): void | PromiseLike<void>;

  /**
   * Ping the underlying connector to test the connections.
   * 
   * @remarks
   * If {@link Connector.ping} is not implemented,
   * {@link Connector.discoverModelProperties} is used instead. Otherwise, an
   * error is thrown.
   */
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
