// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import { AnyObject } from 'strong-globalize/lib/config';
import {Callback, DataSource, ModelBase, ModelBaseClass, ModelDefinition, ModelProperties, Options, PromiseOrVoid, PropertyDefinition, PropertyType, Schema, Where} from '..';

export type ConnectorSettings = Options & {
  name?: string,
  /**
   * Overrides {@link ConnectorSettings.adapter} if defined.
   */
  connector?: ConnectorStatic | string,
  /**
   * @deprecated Use {@link ConnectorSettings.connector} instead.
   */
  adapter?: ConnectorStatic | string,
  connectionTimeout?: number,
  maxOfflineRequests?: number,
  lazyConnect?: boolean,
  debug?: boolean,
}

export type IDPropertiesDiscoveryOptions = {
  owner?: string,
} | {
  schema?: string
}

export type DiscoveryScopeOptions = {
  owner?: string,
  all?: boolean,
  views?: boolean,
  limit?: number,
  offset?: number,
}

export type SchemaDiscoveryOptions = {
  owner?: string,
  /**
   * Overriden by {@link SchemaDiscoveryOptions.associations}.
   */
  relations?: boolean,
  all?: boolean,
  views?: boolean,
  disableCamelCase?: boolean,
  nameMapper?: NameMapper,
  associations?: boolean,
}

export type NameMapper = (type: 'table' | 'model' | 'fk' | string, name: string) => string | null;

export type DiscoveredPrimaryKeys = {
  owner: string | null,
  tableName: string,
  columnName: string,
  keySeq: number,
  pkName: string | null,
}

export type DiscoveredForeignKeys = {
  fkOwner: string | null,
  fkName: string | null,
  fkTableName: string,
  fkColumnName: string,
  keySeq: number,

  pkOwner: string | null,
  pkName: string | null,
  pkTableName: string,
  pkColumnName: string,
}

export type DiscoveredModelProperties = {
  owner?: string,
  tableName?: string,
  columnName?: string,
  dataType?: string,
  dataLength?: number,
  dataPrecision?: number,
  dataScale?: number,
  nullable?: boolean,
}


// #TODO(achrinza): The codebase suggets that `context` differs
// depending on the situation, and that there's no cohesive interface.
// Hence, we'll need to identify all the possible contexts.
export type Context = {
  Model: ModelBaseClass,
  instance?: object,
  query?: {where: Where},
  data?: AnyObject,
  hookState?: AnyObject,
  options?: Options,
  isNewInstance?: boolean,
  currentInstance?: ModelBase,
}

/**
 * Connector from `loopback-connector` module
 */
export interface Connector {
  name: string; // Name/type of the connector
  _models?: object[];
  connect?(callback?: Callback): PromiseOrVoid; // Connect to the underlying system
  disconnect?(callback?: Callback): PromiseOrVoid; // Disconnect from the underlying system

  /**
   * Ping the underlying connector to test the connections.
   * 
   * @remarks
   * Unlike {@link DataSource.ping}, if no callback is provided, a
   * {@link Promise} return value is not guaranteed.
   * 
   * @param callback Callback function
   * @returns a {@link Promise} or `void`
   */
  ping?(callback?: Callback): PromiseOrVoid; // Ping the underlying system
  execute?(...args: any[]): Promise<any>;

  /**
   * Get the connector's types collection.
   * 
   * @remarks
   * For example, ['db', 'nosql', 'mongodb'] would be represent a datasource of
   * type 'db', with a subtype of 'nosql', and would use the 'mongodb' connector.
   *
   * Alternatively, ['rest'] would be a different type altogether, and would have
   * no subtype.
   * 
   * @returns The connector's type collection.
   */
  getTypes?(): string[];
  define?(def: {model: ModelBaseClass, properties: PropertyDefinition, settings: ModelDefinition['settings']}): void;
  defineProperty?(model: string, prop: string, params: PropertyDefinition): void;
  defineForeignKey?(modelName: string, key: string, foreignModelName: string, cb: Callback<PropertyType>): void;
  defineForeignKey?(modelName: string, key: string, cb: Callback<PropertyType>): void;
  
  getDefaultIdType(): object;
  isRelational(): boolean;

  /**
   * Discover existing database tables.
   * 
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverModelDefinitions?(options: DiscoveryScopeOptions, cb: Callback): Promise<ModelDefinition[]>;

  /**
   * {@inheritDoc Connector.discoverModelDefinitions}
   * @deprecated
   */
  discoverModelDefinitionsSync?(options: DiscoveryScopeOptions): ModelDefinition[]

  /**
   * Discover properties for a given model.
   * 
   * @param modelName Target table/view name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverModelProperties?(modelName: string, options: DiscoveryScopeOptions, cb: Callback<DiscoveredModelProperties>): Promise<DiscoveredModelProperties>;
  /**
   * {@inheritDoc Connector.discoverModelProperties}
   * @deprecated
   */
  discoverModelPropertiesSync?(modelName: string, options: DiscoveryScopeOptions): DiscoveredModelProperties;

  /**
   * Discover primary keys for a given owner/model name.
   * 
   * @param modelName Target model name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverPrimaryKeys?(modelName: string, options: IDPropertiesDiscoveryOptions, cb: Callback<DiscoveredPrimaryKeys>): Promise<DiscoveredPrimaryKeys>;

  /**
   * {@inheritDoc Connector.discoverPrimaryKeys}
   * @deprecated
   */
  discoverPrimaryKeysSync?(modelName: string, options: IDPropertiesDiscoveryOptions): DiscoveredPrimaryKeys;

  /**
   * Discover foreign keys for a given owner/model name.
   * 
   * @param modelName Target model name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverForeignKeys?(modelName: string[], options: IDPropertiesDiscoveryOptions, cb: Callback<DiscoveredForeignKeys>): Promise<DiscoveredForeignKeys>;
  /**
   * {@inheritDoc Connector.discoverForeignKeys}
   * @deprecated
   */
  discoverForeignKeysSync?(modelName: string[], options: IDPropertiesDiscoveryOptions): DiscoveredForeignKeys;

  /**
   * Retrieve a description of the foreign key columns that reference the given
   * table's primary key columns (i.e. The foreign keys exported by a table),
   * ordered by `fkOwner`, `fkTableName`, and `keySeq`.
   * 
   * @param modelName Target model name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverExportedForeignKeys?(modelName: string, options: IDPropertiesDiscoveryOptions, cb: Callback<DiscoveredForeignKeys>): Promise<DiscoveredForeignKeys>;

  /**
   * {@inheritDoc Connector/discoverExportedForeignKeys}
   * @deprecated
   */
  discoverExportedForeignKeysSync?(modelName: string, options?: {owner?: string}): DiscoveredForeignKeys;

  /**
   * Discover schema from a given table name / view name.
   * 
   * @param tableName Target table name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverSchemas(tableName: string, options: SchemaDiscoveryOptions, cb: Callback<Schema>): Promise<Schema>;

  /**
   * Check whether or not migrations are required for the database schema to match
   * the model definitions attached to the {@link DataSource}.
   * 
   * @param models Name of models to check. If not defined, all models are checked.
   * @param cb 
   */
  isActual?(models?: string | string[], cb?: Callback<boolean>): void;
  freezeDataSource?(): void;
  freezeSchema?(): void;

  /**
   * Normalize connector-specific return data into standardised Juggler context
   * data.
   * 
   * @remarks
   * Depending on the connector, the database response can contain information
   * about the updated record(s). This object usually has a database-specific
   * structure and does not match model properties. For example, MySQL returns
   * `OkPacket: {fieldCount, affectedRows, insertId, ... , changedRows}`.
   * 
   * The return value is normalised data.
   * 
   * If the connector DDL and DML functions map directly to a hash-map of
   * model properties and their values, this function does not need to be
   * implemented.
   * 
   * @param context 
   * @param dbResponse 
   */
  generateContextData?(context: Context, dbResponse: unknown): Context;

  [property: string]: any; // Other properties that vary by connectors
}

export interface BuiltConnector extends Connector {
  dataSource: DataSource;
  log: DataSource['log'];
  logger(query: string, start: number): (query: string) => void;
}

/**
 * Base connector class
 * 
 * @internal
 */
export declare class ConnectorBase implements Connector {
  name: string; // Name/type of the connector;
  dataSource?: DataSource;
  connect(callback?: Callback): PromiseOrVoid; // Connect to the underlying system
  disconnect(callback?: Callback): PromiseOrVoid; // Disconnect from the underlying system
  ping(callback?: Callback): PromiseOrVoid; // Ping the underlying system
  execute?(...args: any[]): Promise<any>;

  /**
   * Initialize the connector against the given data source
   *
   * @param {DataSource} dataSource The dataSource
   * @param {Function} [callback] The callback function
   */
  static initialize(dataSource: DataSource, callback?: Callback): void;

  constructor(settings?: Options);
  [property: string]: any;
  _models?: object[] | undefined;
  getDefaultIdType(): object;
  isRelational(): boolean;
  discoverSchemas(tableName: string, options: SchemaDiscoveryOptions, cb: Callback<Schema>): Promise<Schema>;
}

export declare interface ConnectorStatic {
  initialize(this: DataSource, callback: Callback): void;
  new (settings: ConnectorSettings): Connector;
}

export declare class Memory extends ConnectorBase {}

export declare class KeyValueMemoryConnector extends ConnectorBase {}

export declare class Transient extends ConnectorBase {}
