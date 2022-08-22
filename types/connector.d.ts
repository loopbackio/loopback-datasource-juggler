// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {AnyObject} from './common';
import {
  Callback,
  DataSource,
  Filter,
  ModelBase,
  ModelBaseClass,
  ModelDefinition,
  ModelProperties,
  Options,
  PromiseOrVoid,
  PropertyDefinition,
  PropertyType,
  Schema,
  Where,
} from '..';
import {DataAccessObject} from './dao';
import {ObserverMixin, OperationHookContext} from './observer';
import {IndexDefinition, ModelData} from './model';
import {ModelUtilsOptions} from './model-utils';

export interface ConnectorSettings extends Options {
  name?: string;
  /**
   * Overrides {@link ConnectorSettings.adapter} if defined.
   */
  connector?: ConnectorExport | string;
  /**
   * @deprecated Use {@link ConnectorSettings.connector} instead.
   */
  adapter?: ConnectorExport | string;
  connectionTimeout?: number;
  maxOfflineRequests?: number;
  lazyConnect?: boolean;
  debug?: boolean;

  url?: string | null;
  hostname?: string | '';
  host?: string | '';
  port?: string | null;
  username?: string | null;
  user?: string | null;
  password?: string;
  database?: string;

  // Postgres-specific
  defaultIdSort?: boolean | 'numericIdOnly';
  onError?: (err: Error | unknown) => unknown | 'ignore';
  // END Postgres-specific

  // MySQL-specific
  createDatabase?: boolean;
  /**
   * @defaultValue `'utf8_general_ci'`
   **/
  charset?: string;
  collation?: string;
  /**
   * @defaultValue `false`
   **/
  supportBigNumbers?: boolean;
  /**
   * @defaultValue `'local'`
   **/
  timezone?: string;
  /**
   * @defaultValue `10`
   **/
  connectionLimit?: number;
  // END MySQL-specific

  // MSSQL-specific
  tableNameID?: string;
  // END MSSQL-specific

  // CouchDB2 & Cloudant-specific
  Driver?: object; // CouchDB driver
  // END CouchDB2 & Cloudant-specific

  // Cassandra-specific
  keyspace?: string;
  createKeyspace?: boolean;
  replication?: {
    /**
     * @example `'SimpleStrategy'`
     */
    class: string;
    replication_factor: number;
  };
  // END Cassandra-specific
}

export interface IDPropertiesDiscoveryOptions {
  owner?: string;
  schema?: string;
}

export interface DiscoveryScopeOptions {
  owner?: string;
  all?: boolean;
  views?: boolean;
  limit?: number;
  offset?: number;
}

export interface SchemaDiscoveryOptions {
  /**
   * Sets if all owners are included.
   */
  all?: boolean;

  /**
   * Sets if views are included.
   */
  views?: boolean;

  /**
   * Sets if the database foreign key column names should be transformed.
   *
   * @remarks
   * Used by the default built-in {@link NameMapper} implementation to transform
   * the database column names to use camel-case, LoopBack's default naming
   * conventions.
   *
   * @defaultValue `false`
   */
  disableCamelCase?: boolean;

  /**
   * A custom database table name, model, and foreign key transformer.
   *
   * @remarks
   * If `null`, no transform is performed.
   * If `undefined`, default built-in transformer is used.
   */
  nameMapper?: NameMapper | null;

  /**
   * Sets if associations/relations should be navigated.
   *
   * @remarks
   * Alias of {@link SchemaDiscoveryOptions.relations}
   */
  associations?: boolean;

  /**
   * Sets if associations/relations should be navigated.
   *
   * @remarks
   * Alias of {@link SchemaDiscoveryOptions.associations}.
   */
  relations?: boolean;

  owner?: string;
  schema?: string;
}

/**
 * Transform database discovery results
 *
 * @reamrks
 * See also {@link Connector.dbName} which is for converting the other
 * direction.
 */
export type NameMapper = (
  type: 'table' | 'model' | 'fk' | string,
  name: string,
) => string | null;

export interface BuildQueryOptions {
  /**
   * Build a query to search tables/views/schemas from any owner.
   *
   * @remarks
   * Ignored when {@link BuildQueryOptions.owner} or
   * {@link BuildQueryOptions.schema} is defined.
   */
  all?: boolean;
  /**
   * Filter query to a certain table/view/schema owner.
   *
   * @remarks
   * Overrides {@link BuildQueryOptions.all} when defined.
   * Alias of {@link BuildQueryOptions.schema} with higher precedence.
   */
  owner?: string;
  /**
   * @remarks
   * Alias of {@link BuildQueryOptions.owner} with lower precedence.
   */
  schema?: string;
}

export interface DiscoveredPrimaryKeys {
  owner: string | null;
  tableName: string;
  columnName: string;
  keySeq: number;
  pkName: string | null;
}

export interface DiscoveredForeignKeys {
  fkOwner: string | null;
  fkName: string | null;
  fkTableName: string;
  fkColumnName: string;
  keySeq: number;

  pkOwner: string | null;
  pkName: string | null;
  pkTableName: string;
  pkColumnName: string;
}

export interface DiscoveredModelProperties {
  owner?: string;
  tableName?: string;
  columnName?: string;
  dataType?: string;
  dataLength?: number;
  dataPrecision?: number;
  dataScale?: number;
  /**
   * {@inheritDoc ConnectorSpecificPropertyDefinition.nullable}
   */
  nullable?: 0 | 'N' | 'NO' | 1 | 'Y' | 'YES' | boolean;
}

// #TODO(achrinza): The codebase suggets that `context` differs
// depending on the situation, and that there's no cohesive interface.
// Hence, we'll need to identify all the possible contexts.
export interface Context {
  Model: ModelBaseClass;
  instance?: object;
  query?: Filter;
  where?: Where;
  data?: AnyObject;
  hookState: object;
  options: Options;
  isNewInstance?: boolean;
  currentInstance?: Readonly<ModelBase>;
}

export interface ConnectorHookBeforeExecuteContext {
  req: Record<string, unknown>;
  end: Callback<ConnectorHookBeforeExecuteContext>;
}

export interface ConnectorHookAfterExecuteContext
  extends ConnectorHookBeforeExecuteContext {
  res: Record<string, unknown>;
}

interface ConnectorMetadata {
  types: string[];
  defaultIdType: object;
  isRelational: boolean;
  schemaForSettings: Record<string, any>;
}

/**
 * Connector from `loopback-connector` module
 */
export interface Connector {
  name: string; // Name/type of the connector

  DataAccessObject?: DataAccessObject;

  /**
   * The {@link DataSource} which the Connector is/will attach to.
   *
   * @remarks
   * In most cases, the Connector does not need to pre-populate this and this
   * will be set by the {@link DataSource} itself.
   *
   * By pre-populating this field before initialisation, it is assumed that the
   * Connector would handle setting up the DataSource.
   */
  dataSource?: DataSource;

  relational: boolean;

  // private _models?: Record<string, ModelDefinition>;
  // private _metadata?: ConnectorMetadata;

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
   * @returns `Promise<void>` if no callback is passed. Otherwise, `void`
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
   * Note that returning a comma-delimeted string (e.g. `'db,nosql,mongodb'`) is
   * deprecated and strongly not recommended. It is kept for
   * backwards-compatibility only.
   *
   * @returns The connector's type collection.
   */
  getTypes?(): string[] | string;
  define?(def: {
    model: ModelBaseClass;
    properties: PropertyDefinition;
    settings: ModelDefinition['settings'];
  }): void;

  all?(
    model: string,
    filter: Filter,
    options: ModelUtilsOptions | null,
    cb: Callback<ModelData[]>,
  ): void;
  findAll?: Connector['all'];
  find?(
    model: string,
    value: unknown,
    options: ModelUtilsOptions,
    cb: Callback<ModelData>,
  ): void;
  count?(
    model: string,
    where: Where,
    options: ModelUtilsOptions,
    cb: Callback<number>,
  ): void;

  serializeObject?(obj: object): unknown;
  escapeObject?(obj: object): unknown;
  escapeValue?(obj: object): unknown | null;
  getTableStatus?(
    model: string,
    cb: (
      err: any,
      fields?: PropertyDefinition,
      indexes?: IndexDefinition,
    ) => void,
  ): void;

  fromDatabase?(model: string, rowData: object): ModelData;
  fromRow?: Connector['fromDatabase'];

  /**
   * Define a property on the target model.
   *
   * @param model Name of model
   * @param prop Name of property
   * @param params Property settings
   */
  defineProperty?(
    model: string,
    prop: string,
    params: PropertyDefinition,
  ): void;
  defineForeignKey?(
    modelName: string,
    key: string,
    foreignModelName: string,
    cb: Callback<PropertyType>,
  ): void;
  defineForeignKey?(
    modelName: string,
    key: string,
    cb: Callback<PropertyType>,
  ): void;

  getDefaultIdType(): object;
  isRelational(): boolean;

  buildQuerySchemas?(options: BuildQueryOptions): string;
  buildQueryTables?(options: BuildQueryOptions): string;
  buildQueryViews?(options: BuildQueryOptions): string;
  buildQueryColumns?(owner: string | null, table: string): string;
  buildQueryForeignKeys?(owner?: string, table?: string): string;
  buildQueryExportedForeignKeys?(owner?: string, table?: string): string;
  buildColumnDefinitions?(model: string): string;
  propertiesSQL: Connector['buildColumnDefinitions']; // Postgresql-specific

  createTable?(model: string, cb: Callback): void;
  alterTable?(
    model: string,
    actualFields: PropertyDefinition[],
    actualIndexes: IndexDefinition[],
    cb: Callback,
  ): void;
  alterTable?(
    model: string,
    actualFields: PropertyDefinition[],
    actualIndexes: IndexDefinition[],
    actualFks: unknown,
    cb: Callback,
    checkOnly?: boolean,
  ): void;
  dropTable?(model: string, cb: Callback): void;
  /**
   * Generate SQL statement to add and remove indexes to sync with database.
   *
   * @param model
   * @param actualIndexes
   */
  addIndexes?(model: string, actualIndexes: IndexDefinition[]): void;
  showIndexes?(model: string, cb: Callback<IndexDefinition[]>): void;
  showFields?(model: string, cb: Callback<PropertyDefinition[]>): void;
  /**
   *
   * @param model
   * @param actualFields
   * @returns Array of SQL statement
   */
  getColumnsToAdd?(model: string, actualFields: PropertyDefinition[]): string[];
  getDropColumns?(model: string, actualFields: PropertyDefinition[]): string;
  getColumnsToDrop?(
    model: string,
    actualFields: PropertyDefinition[],
  ): string[];

  /**
   *
   * @remarks
   * This is a thin wrapper around {@link Connector.getColumnsToAdd}.
   *
   * @param model
   * @param actualFields
   * @returns SQL statement
   */
  getAddModifyColumns?(
    model: string,
    actualFields: PropertyDefinition[],
  ): string;

  /**
   * Mutate `options` parameter to populate missing options with default values
   *
   * @param options Connector-specific options to be populated
   */
  setDefaultOptions?(options: Options): Options | void;
  setNullableProperty?(property: PropertyDefinition): void;

  /**
   * Normalize the arguments
   *
   * @returns Normalized arguments
   */
  getArgs?(
    table: string,
    options?: Options,
    cb?: Callback,
  ): {
    schema: string;
    owner: string;
    table: string;
    options?: Options;
    cb: Callback;
  };

  getArgs?(
    table: string,
    cb?: Callback,
  ): {
    schema: string;
    owner: string;
    table: string;
    options?: Options;
    cb: Callback;
  };

  /**
   * Convert the property name to a database-specific name.
   *
   * @remarks
   * This function is intended to be used for general conversion of the property
   * name from the Juggler {@link PropertyDefinition} to one that is compatible
   * with the {@link Connector} database.
   *
   * This is useful if the database has stricter requirements than JavaScript
   * {@link string}.
   */
  dbName?(mappingName: string): string

  /**
   * Modify the SQL statement to include pagination clauses.
   *
   * @param sql The SQL statement to be modified
   * @param orderBy The property name by which results are ordered
   * @param options Options for pagination
   */
  paginateSQL?(
    sql: string,
    orderBy: string,
    options: Pick<Filter, 'offset' | 'skip' | 'limit'>,
  ): string;

  /**
   * Discover the default target database schema.
   *
   * @param options
   * @returns Name of the database schema that will be targeted by default
   */
  getDefaultSchema?(options?: Options): string | undefined | '';

  /**
   * Retrieve the default target database schema.
   *
   * @remarks
   * This is based on locally-available information, such as
   * {@link ConnectorSettings['database']}.
   *
   * @returns Name of the database schema that will be targeted by default
   */
  getDefaultSchemaName?(): string | '';

  /**
   * @remarks
   * This is retrieved from `_models[modelName]`.
   */
  getModelDefinition?(modelName: string): ModelDefinition | undefined;

  /**
   * Retrieve non-standard settings that's recognised by the {@link Connector}.
   *
   * @remarks
   * For some connectors, this may return {@link ModelSettings} as-is. This is
   * the default behaviour implemented in the base
   * {@link loopback-connector#Connector} class which most Connectors inherit
   * from.
   *
   * It is important to deep-clone as needed before manipulating the returned
   * object.
   */
  getConnectorSpecificSettings?(modelName: string): Record<string, any>;

  /**
   * Discover existing database tables.
   *
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverModelDefinitions?(
    options: DiscoveryScopeOptions,
    cb: Callback,
  ): Promise<ModelDefinition[]>;

  /**
   * {@inheritDoc Connector.discoverModelDefinitions}
   * @deprecated
   */
  discoverModelDefinitionsSync?(
    options: DiscoveryScopeOptions,
  ): ModelDefinition[];

  /**
   * Discover properties for a given model.
   *
   * @param modelName Target table/view name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverModelProperties?(
    modelName: string,
    options: DiscoveryScopeOptions,
    cb: Callback<DiscoveredModelProperties>,
  ): Promise<DiscoveredModelProperties>;

  /**
   * {@inheritDoc Connector.discoverModelProperties}
   * @deprecated
   */
  discoverModelPropertiesSync?(
    modelName: string,
    options: DiscoveryScopeOptions,
  ): DiscoveredModelProperties;

  /**
   * Discover primary keys for a given owner/model name.
   *
   * @param modelName Target model name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverPrimaryKeys?(
    modelName: string,
    options: IDPropertiesDiscoveryOptions,
    cb: Callback<DiscoveredPrimaryKeys>,
  ): Promise<DiscoveredPrimaryKeys>;

  /**
   * {@inheritDoc Connector.discoverPrimaryKeys}
   * @deprecated
   */
  discoverPrimaryKeysSync?(
    modelName: string,
    options: IDPropertiesDiscoveryOptions,
  ): DiscoveredPrimaryKeys;

  /**discover.
   * Discover foreign keys for a given owner/model name.
   *
   * @param modelName Target model name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverForeignKeys?(
    modelName: string[],
    options: IDPropertiesDiscoveryOptions,
    cb: Callback<DiscoveredForeignKeys>,
  ): Promise<DiscoveredForeignKeys>;
  /**
   * {@inheritDoc Connector.discoverForeignKeys}
   * @deprecated
   */
  discoverForeignKeysSync?(
    modelName: string[],
    options: IDPropertiesDiscoveryOptions,
  ): DiscoveredForeignKeys;

  /**
   * Retrieve a description of the foreign key columns that reference the given
   * table's primary key columns (i.e. The foreign keys exported by a table),
   * ordered by `fkOwner`, `fkTableName`, and `keySeq`.
   *
   * @param modelName Target model name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverExportedForeignKeys?(
    modelName: string,
    options: IDPropertiesDiscoveryOptions,
    cb: Callback<DiscoveredForeignKeys>,
  ): Promise<DiscoveredForeignKeys>;

  /**
   * {@inheritDoc Connector/discoverExportedForeignKeys}
   * @deprecated
   */
  discoverExportedForeignKeysSync?(
    modelName: string,
    options?: {owner?: string},
  ): DiscoveredForeignKeys;

  /**
   * Discover schema from a given table name / view name.
   *
   * @param tableName Target table name
   * @param options Discovery options
   * @param cb Callback function
   */
  discoverSchemas?(
    tableName: string,
    options: SchemaDiscoveryOptions,
    cb: Callback<Schema>,
  ): Promise<Schema>;

  /**
   * Check whether or not migrations are required for the database schema to match
   * the model definitions attached to the {@link DataSource}.
   *
   * @param models Name of models to check. If not defined, all models are checked.
   * @param cb
   */
  isActual?(models?: string | string[], cb?: Callback<boolean>): void;

  /**
   * Freeze the datasource. Behaviour depends on the {@link Connector}.
   */
  freezeDataSource?(): void;

  /**
   * {@inheritDoc Connector.freezeDataSource}
   *
   * @remarks
   * This is kept for backwards-compatibility with JugglingDB connectors.
   * Connectors should implement {@link Connector.freezeDataSource}.
   */
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

  generateUniqueId?(modelName?: string): unknown | null;
  generateValueByColumnType?(idType: object): unknown;
  getMetadata(): ConnectorMetadata;
}

export declare class SQLConnector {}

/**
 * A {@link Connector} after being attached to a {@link DataSource}.
 *
 * @remarks
 * The {@link DataSource} manipulates the {@link Connector} during attachment
 * (e.g. when passed in {@link DataSource.constructor}). This type defines those
 * mutations.
 */
export interface BuiltConnector extends ObserverMixin {
  // DataSource
  dataSource: DataSource;
  log: DataSource['log'];
  logger(query: string, start: number): (query: string) => void;
}

/**
 * The interface that a connector must implement.
 *
 * @remarks
 * As {@link Connector} is an interface and not a class, it's not possible to
 * represent static methods. Hence, this is a workaround that has been generally
 * accepted by the TypeScript community to define the interface of a
 * prototype-based class.
 */
export declare interface ConnectorExport {
  initialize: ConnectorInitialize;
}

export type ConnectorInitialize = (
  this: DataSource,
  callback: Callback,
) => void;
