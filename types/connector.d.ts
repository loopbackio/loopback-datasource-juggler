// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Callback, DataSource, ModelBaseClass, ModelDefinition, ModelProperties, Options, PromiseOrVoid, PropertyDefinition, PropertyType, Schema} from '..';

// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

export type DiscoveryScopeOptions = {
  owner?: string,
  all?: boolean,
  views?: boolean,
  limit?: number,
  offset?: number,
}

export type SchemaDiscoveryOptions = {
  owner?: string,
  relations?: boolean,
  all?: boolean,
  views?: boolean,
}

export type PrimaryKeysDiscoveryReturnValue = {
  owner?: string | null,
  tableName?: string,
  columnName?: string,
  keySeq?: number,
  pkName?: string | null,
}

export type ForeignKeysDiscoveryReturnValue = {
  fkOwner?: string | null,
  fkName?: string | null,
  fkTableName?: string,
  fkColumnName?: string,
  keySeq?: number,
  pkOwner?: string | null,
  pkName?: string | null,
  pkTableName?: string,
  pkColumnName?: string,
}

export type ModelPropertiesDiscoveryReturnValue = {
  owner?: string,
  tableName?: string,
  columnName?: string,
  dataType?: string,
  dataLength?: number,
  dataPrecision?: number,
  dataScale?: number,
  nullable?: boolean,
}

/**
 * Connector from `loopback-connector` module
 */
export interface Connector {
  name: string; // Name/type of the connector
  dataSource?: DataSource;
  connect?(callback?: Callback): PromiseOrVoid; // Connect to the underlying system
  disconnect?(callback?: Callback): PromiseOrVoid; // Disconnect from the underlying system
  ping(callback?: Callback): PromiseOrVoid; // Ping the underlying system
  execute?(...args: any[]): Promise<any>;
  getDefaultIdType(): object;
  getTypes?(): string[];
  define?(def: {model: ModelBaseClass, properties: PropertyDefinition, settings: ModelDefinition['settings']}): void;
  defineProperty?(model: string, prop: string, params: PropertyDefinition): void;
  defineForeignKey?(modelName: string, key: string, foreignModelName: string, cb: Callback<PropertyType>): void;
  defineForeignKey?(modelName: string, key: string, cb: Callback<PropertyType>): void;
  discoverModelDefinitions?(options: DiscoveryScopeOptions, cb?: Callback): Promise<ModelDefinition>;
  /**
   * @deprecated
   */
  discoverModelDefinitionsSync?(options: DiscoveryScopeOptions): ModelDefinition
  discoverModelProperties?(modelName: string, options: DiscoveryScopeOptions, cb: Callback<ModelPropertiesDiscoveryReturnValue>): Promise<ModelPropertiesDiscoveryReturnValue>;
  /**
   * @deprecated
   */
  discoverModelPropertiesSync?(modelName: string, options: DiscoveryScopeOptions): ModelPropertiesDiscoveryReturnValue;
  discoverPrimaryKeys?(modelName: string, options: {owner?: string}, cb: Callback<PrimaryKeysDiscoveryReturnValue>): Promise<PrimaryKeysDiscoveryReturnValue>;
  /**
   * @deprecated
   */
  discoverPrimaryKeysSync?(modelName: string, options: {owner?: string}): PrimaryKeysDiscoveryReturnValue;
  discoverForeignKeys?(modelName: string[], options: {owner?: string}, cb: Callback<ForeignKeysDiscoveryReturnValue>): Promise<ForeignKeysDiscoveryReturnValue>;
  /**
   * @deprecated
   */
  discoverForeignKeysSync?(modelName: string[], options: {owner?: string}): ForeignKeysDiscoveryReturnValue;
  discoverExportedForeignKeys?(modelName: string, options: {owner?: string}, cb: Callback<ForeignKeysDiscoveryReturnValue>): Promise<ForeignKeysDiscoveryReturnValue>;
  /**
   * @deprecated
   */
  discoverExportedForeignKeysSync?(modelName: string, options?: {owner?: string}): ForeignKeysDiscoveryReturnValue;
  discoverSchemas(tableName: string, options: SchemaDiscoveryOptions, cb: Callback<Schema>): Promise<Schema>;

  isActual?(models: string[], cb: Callback<boolean>): void;
  freezeDataSource?(): void;
  freezeSchema?(): void;
  [property: string]: any; // Other properties that vary by connectors
}

/**
 * Base connector class
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
}

export declare class Memory extends ConnectorBase {}

export declare class KeyValueMemoryConnector extends ConnectorBase {}

export declare class Transient extends ConnectorBase {}
