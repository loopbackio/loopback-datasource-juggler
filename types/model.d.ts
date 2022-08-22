// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {EventEmitter} from 'events';
import {AnyObject, Options} from './common';
import {DataSource} from './datasource';
import {Listener, OperationHookContext} from './observer';
import {ModelUtilsOptions} from './model-utils';
import registerModelTypes = require('./types');
import { ModelBuilder } from './model-builder';

/**
 * Property types
 */
export type PropertyType =
  | 'GeoPoint'
  | 'Point' // Legacy carry-over from JugglingDB. Alias of `GeoPoint`.
  | string
  | Function
  | {[property: string]: PropertyType};

export type DefaultFns =
  | 'guid'
  | 'uuid'
  | 'uuidv4'
  | 'now'
  | 'shortid'
  | 'nanoid'
  | string;

interface ConnectorSpecificPropertyDefinition {
  /**
   * {@inheritDoc PropertyDefinition.name}
   */
  column?: string;
  /**
   * {@inheritDoc PropertyDefinition.name}
   * @deprecated Use {@link ConnectorSpecificPropertyDefinition.column} instead.
   */
  columnName?: string;
  /**
   * {@inheritDoc PropertyDefinition.name}
   */
  field?: string;
  /**
   * {@inheritDoc PropertyDefinition.name}
   * @deprecated Use {@link ConnectorSpecificPropertyDefinition.field} instead.
   */
  fieldName?: string;
  dataType?: string;
  dataLength?: number;
  dataPrecision?: number;
  dataScale?: number;
  index?: boolean | string | IndexDefinition;
  /**
   * @remarks
   * Support for the different representations is dependent on the
   * {@link Connector}. For best compatibility, use `true` and `false`. Consult
   * the respective Connectors' documentation for more information.
   */
  nullable?: 1 | 'Y' | 'YES' | 0 | 'N' | 'NO' | boolean;
  /**
   * @deprecated Use {@link ConnectorSpecificPropertyDefinition.nullable} instead.
   */
  null?: boolean;
  /**
   * @deprecated Use {@link ConnectorSpecificPropertyDefinition.nullable} instead.
   */
  allowNull?: boolean;
  // PostgreSQL-specific?
  autoIncrement?: boolean;
}

interface ConnectorSpecificPropertyDefinitionIndex {
  [connectorNameOrType: string]: ConnectorSpecificPropertyDefinition;
}

/**
 * Property definition
 */
export interface PropertyDefinition extends AnyObject, ConnectorSpecificPropertyDefinitionIndex {
  type?: PropertyType;
  id?: boolean | number;
  defaultFn?: DefaultFns;
  /**
   * @defaultValue `true`
   */
  useDefaultIdType?: boolean;
  /**
   * Sets the column/field name in the database.
   *
   * @remarks
   * Precedence:
   * - {@link PropertyDefinition.name}
   * - {@link PropertyDefinition[connectorName].column}
   * - {@link PropertyDefinition[connectorName].columnName}
   * - {@link PropertyDefinition[connectorName].field}
   * - {@link PropertyDefinition[connectorName].fieldName}
   */
  name?: string;
  nullable?: boolean;

  [key: string]: any;
}

/**
 * Schema definition
 */
export interface Schema {
  name: string;
  properties: ModelProperties;
  settings?: ModelSettings;
}

/**
 * ID definition
 */
export interface IdDefinition {
  name: string;
  id: number;
  property: PropertyDefinition;
}
/**
 * Column metadata
 */
export interface ColumnMetadata extends AnyObject {
  name: string;
}

/**
 * Definition of model properties, for example
 * ```ts
 * {
 *   name: {type: String, required: true},
 * }
 * ```
 */
export interface ModelProperties {
  [name: string]: PropertyDefinition;
}

export interface IndexDefinition {
  /**
   * @remarks
   * This should not end with a trailing '_index' as this may lead to collisions
   * with indexes defined through {@link PropertyDefinition.index}.
   *
   * If not set, the index name may be inferred from the object key which this
   * index definition is stored in.
   */
  name?: string;

  /**
   * Comma-separated column names:
   *
   * @remarks
   * Handled by {@link Connector}s directly by default.
   *
   * Overriden by {@link IndexDefinition.keys}.
   */
  columns: string;
  /**
   * Array of column names to create an index.
   *
   * @remarks
   * Handled by {@link Connector}s directly by default.
   *
   * Overrides {@link ModelSettings.indexes.columns}.
   */
  keys?: string[];

  type?: string;
  kind?: string;
  unique?: string;

  options?: Record<string, any>;
}

export interface ConnectorSpecificModelSettingsIndex {
  [connectorName: string]: ConnectorSpecificModelSettings;
}

export interface ConnectorSpecificModelSettings {
  /**
   * The database schema which the table is located in.
   */
  schema?: string;

  /**
   * @remarks
   * Overriden by `schema`.
   *
   * @deprecated Use `schema` instead.
   */
  schemaName?: string;

  /**
   * Mapped table name for the model.
   */
  table?: string;

  /**
   *
   * @remarks
   * Overriden by `table`.
   *
   * @deprecated Use `table` instead.
   */
  tableName?: string;
}

/**
 * Model settings, for example
 * ```ts
 * {
 *   strict: true,
 * }
 * ```
 */
export interface ModelSettings
  extends AnyObject,
    ModelUtilsOptions,
    Pick<ConnectorSpecificModelSettings, 'schema' | 'schemaName'>,
    ConnectorSpecificModelSettingsIndex {
  strict?: boolean;

  /**
   * Set if manual assignment of auto-generated ID values should be blocked.
   */
  forceId?: boolean | 'auto';

  properties?: ModelProperties;

  /**
   * @deprecated Use {@link ModelSettings.properties} instead.
   */
  attributes?: ModelProperties;

  /**
   * @remarks
   * Defaults to `true`.
   */
  idInjection?: boolean;

  plural?: string;

  http?: {
    path?: string;
  };

  /**
   * @remarks
   * Used by {@link ModelBuilder.define}.
   */
  models?: (string | ModelBaseClass)[];

  scope?: AnyObject | Function;

  /**
   * @remarks
   * Alias of {@link ModelSettings.super}. Takes higher precedence.
   */
  base?: ModelBaseClass;

  /**
   * @remarks
   * Alias of {@link ModelSettings.base}. Takes lower precedence.
   *
   * This is taken from the behaviour of {@link util#inherits}.
   */
  super?: ModelBaseClass;
  excludeBaseProperties?: string[];

  /**
   * Indicates if the {@link ModelBaseClass | Model} is attached to the
   * DataSource.
   *
   * @remarks
   * This is managed by {@link ModelBuilder}.
   *
   * @internal
   */
  unresolved?: boolean;

  indexes?: {
    [indexJugglerName: string]: IndexDefinition;
  };

  foreignKeys?: {
    [fkJugglerName: string]: {
      name: string;
      entity: ModelBase | string;
      entityKey: string;
      foreignKey: string;
      onDelete?: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'SET DEFAULT' | string;
      onUpdate?: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'SET DEFAULT' | string;
    };
  };

  /**
   * Sets if JavaScript {@link undefined} as an attribute value should be
   * normalized and persisted as database `NULL`.
   *
   * @remarks
   * This setting applies towards functions that set a {@link ModelBase}
   * instance's properties, which is a separate step from saving the instance to
   * the database through the attached {@link DataSource}.
   */
  persistUndefinedAsNull?: boolean;

  /**
   * Model properties to be set as protected.
   *
   * @remarks
   * Protected properties are not serialised to JSON or {@link object} when the
   * model is a nested child.
   *
   * Mostly used by {@link ModelBase.toObject}.
   */
  protectedProperties?: string[];

  /**
   * {@inheritDoc ModelSettings.protectedProperties}
   *
   * @remarks
   * Overriden by {@link ModelSettings.protectedProperties}.
   *
   * @deprecated Use {@link ModelSettings.protectedProperties} instead.
   */
  protected?: string[];

  /**
   * Model properties to be set as hidden.
   *
   * @remarks
   * Hidden properties are
   */
  hiddenProperties?: string[];

  /**
   * {@inheritDoc ModelSettings.hiddenProperties}
   *
   * @remarks
   * Overriden by {@link ModelSettings.hiddenProperties}.
   *
   * @deprecated Use {@link ModelSettings.hiddenProperties} instead.
   */
  hidden?: string[];
  automaticValidation?: boolean;
  updateOnLoad?: boolean;
  validateUpsert?: boolean;

  /**
   * Sets if an {@link Error} should be thrown when no instance(s) were found
   * for delete operation.
   *
   * @remarks
   * This setting is used by these operations:
   *
   * - {@link DataAccessObject.removeById}/{@link DataAccessObject.destroyById}/{@link DataAccessObject.deleteById}
   * - {@link DataAccessObject.remove}/{@link DataAccessObject.delete}/{@link DataAccessObject.destroy}
   */
  strictDelete?: boolean;

  updateOnly?: boolean;

  // Postgres-specific
  defaultIdSort?: boolean | 'numericIdOnly';
}

/**
 * Model definition
 */
export declare class ModelDefinition
  extends EventEmitter
  implements Omit<Schema, 'properties'>
{
  name: string;
  /**
   * A map of {@link PropertyDefinition}s
   *
   * @remarks
   * This is only populated after {@link ModelDefinition.build} is called.
   */
  properties: ModelProperties | null;
  /**
   * A map of {@link PropertyDefinition}s
   *
   * @remarks
   * Unlike {@link ModelDefinition.properties}, this may
   */
  rawProperties: ModelProperties;
  settings?: ModelSettings;
  relations?: AnyObject[];

  constructor(
    modelBuilder: ModelBuilder | null | undefined,
    name: string,
    properties?: ModelProperties,
    settings?: ModelSettings,
  );
  constructor(modelBuilder: ModelBuilder | null | undefined, schema: Schema);

  tableName(connectorType: string): string;
  columnName(connectorType: string, propertyName: string): string;
  columnNames(connectorType: string): string[];
  columnMetadata(connectorType: string, propertyName: string): ColumnMetadata;

  ids(): IdDefinition[];
  /**
   * @deprecated Use {@link ModelDefinition.idNames} instead.
   */
  idName(): string;
  idNames(): string[];

  defineProperty(
    propertyName: string,
    propertyDefinition: PropertyDefinition,
  ): void;
  indexes(): {[name: string | `${string}_index`]: IndexDefinition | boolean};
  build(forceRebuild?: boolean): AnyObject;
  toJSON(forceRebuild?: boolean): AnyObject;
}

export interface ModelBaseClassOptions {
  applySetters?: boolean;
  applyDefaultValues?: boolean;
  strict?: boolean;
  persisted?: boolean;
}

interface ModelMergePolicy {
  description?: {
    replace: boolean;
  };
  properties?: {
    patch: boolean;
  }; // Only referenced in "legacy built-in merge policy"
  options?: {
    path: boolean;
  };
  hidden?: {
    replace: boolean;
  };
  protected?: {
    replace: boolean;
  };
  indexes?: {
    patch: boolean;
  };
  methods?: {
    patch: boolean;
  };
  mixins?: {
    patch: boolean;
  };
  relations?: {
    patch: boolean;
  };
  scope?: {
    replace: boolean;
  };
  acls?: {
    rank: boolean;
  };

  __delete?: boolean | null;

  /**
   * Default merge policy to be applied when merge policy is `null`
   */
  __default?: {
    replace: boolean;
  };
}

interface ModelMergePolicyOptions {
  configureModelMerge: boolean | object;
}

/**
 * Base class for LoopBack 3.x models
 */
export declare class ModelBase {
  /**
   * @deprecated
   */
  static dataSource?: DataSource;
  static modelName: string;
  static definition: ModelDefinition;
  static hideInternalProperties?: boolean;
  static readonly base: typeof ModelBase;

  /**
   * Model inheritance rank
   *
   * @remarks
   * This is used by {@link ModelBuilder}.
   *
   * @internal
   */
  static __rank?: number;

  /**
   * Initializes the model instance with a list of properties.
   *
   * @param data The data object
   * @param options Instation options
   */
  private _initProperties(data: object, options: typeof ModelBase): void;

  /**
   * Extend the model with the specified model, properties, and other settings.
   * For example, to extend an existing model:
   *
   * ```js
   * const Customer = User.extend('Customer', {
   *   accountId: String,
   *   vip: Boolean
   * });
   * ```
   *
   * @param className Name of the new model being defined.
   * @param subClassProperties child model properties, added to base model
   *   properties.
   * @param subClassSettings child model settings such as relations and acls,
   *   merged with base model settings.
   */
  static extend<ChildModel extends typeof ModelBase = typeof ModelBase>(
    modelName: string,
    properties?: ModelProperties,
    settings?: ModelSettings,
  ): ChildModel;

  /**
   * Attach the model class to a data source
   * @param ds The data source
   */
  static attachTo(ds: DataSource): void;

  /**
   * Get model property type.
   * @param {string} propName Property name
   * @returns {string} Name of property type
   */
  static getPropertyType(propName: string): string | null;

  /**
   * {@inheritDoc ModelBaseClass.getPropertyType}
   */
  getPropertyType: ModelBaseClass['getPropertyType'];

  /**
   * Checks if property is hidden.
   * @param propertyName Property name
   * @returns true or false if hidden or not.
   */
  static isHiddenProperty(propertyName: string): boolean;

  /**
   * Checks if property is protected.
   * @param propertyName Property name
   * @returns true or false if protected or not.
   */
  static isProtectedProperty(propertyName: string): boolean;

  /**
   * Gets properties defined with 'updateOnly' flag set to true from the model.
   * This flag is also set to true internally for the id property, if this
   * property is generated and IdInjection is true.
   * @returns {updateOnlyProps} List of properties with updateOnly set to true.
   */
  static getUpdateOnlyProperties(): string[];

  /**
   * Constructor for ModelBase
   *
   * NOTE: We have to use `constructor(...args: any[]);` so that it can be used
   * for `return class extends superClass`.
   *
   * @param {AnyObject} data Initial object data
   * @param {Options} options An object to control the instantiation
   */
  constructor(...args: any[]);
  // constructor(data: AnyObject, options?: Options);

  /**
   * Convert the model instance to a plain json object
   */
  toJSON(): AnyObject;

  /**
   * Populate properties from a JSON object
   * @param obj The source object
   */
  fromObject(obj: AnyObject): void;

  /**
   * Convert model instance to a plain JSON object.
   * Returns a canonical object representation (no getters and setters).
   *
   * @param options Options for the conversion
   * @property {boolean} onlySchema Restrict properties to dataSource only.
   * Default is false.  If true, the function returns only properties defined
   * in the schema;  Otherwise it returns all enumerable properties.
   * @property {boolean} removeHidden Boolean flag as part of the transformation.
   * If true, then hidden properties should not be brought out.
   * @property {boolean} removeProtected Boolean flag as part of the transformation.
   * If true, then protected properties should not be brought out.
   * @returns {object} returns Plain JSON object
   */
  toObject(options?: {
    onlySchema?: boolean;
    removeHidden?: boolean;
    removeProtected?: boolean;
  }): AnyObject;

  /**
   * Define a property on the model.
   * @param {string} prop Property name
   * @param definition Various property configuration
   */
  defineProperty(
    propertyName: string,
    definition: Partial<PropertyDefinition>,
  ): void;

  getDataSource(): DataSource;

  /**
   * Set instance-level strict mode.
   * @param strict Strict mode
   */
  setStrict(strict: boolean): void;

  /**
   *
   * @param {string} anotherClass could be string or class. Name of the class
   * or the class itself
   * @param {Object} options An object to control the instantiation
   * @returns {ModelClass}
   */
  static mixin(
    anotherClass: string | ModelBaseClass | object,
    options?: Options,
  ): ModelBaseClass;

  // ObserverMixin members are added as static methods, this is difficult to
  // describe in TypeScript in a way that's easy to use by consumers.
  // As a workaround, we include a copy of ObserverMixin members here.
  //
  // Ideally, we want to describe the context argument as
  // `OperationHookContext<this>`. Unfortunately, that's not supported by
  // TypeScript for static members. A nice workaround is described in
  // https://github.com/microsoft/TypeScript/issues/5863#issuecomment-410887254
  // - Describe the context using a generic argument `T`.
  // - Use `this: T` argument to let the compiler infer what's the target
  //   model class we are going to observe.

  /**
   * Register an asynchronous observer for the given operation (event).
   *
   * Example:
   *
   * Registers a `before save` observer for a given model.
   *
   * ```javascript
   * MyModel.observe('before save', function filterProperties(ctx, next) {
   *   if (ctx.options && ctx.options.skipPropertyFilter) return next();
   *     if (ctx.instance) {
   *       FILTERED_PROPERTIES.forEach(function(p) {
   *       ctx.instance.unsetAttribute(p);
   *     });
   *   } else {
   *     FILTERED_PROPERTIES.forEach(function(p) {
   *       delete ctx.data[p];
   *     });
   *   }
   *   next();
   * });
   * ```
   *
   * @param {String} operation The operation name.
   * @callback {function} listener The listener function. It will be invoked with
   * `this` set to the model constructor, e.g. `User`.
   * @end
   */
  static observe<T extends typeof ModelBase>(
    this: T,
    operation: string,
    listener: Listener<OperationHookContext<T>>,
  ): void;

  /**
   * Unregister an asynchronous observer for the given operation (event).
   *
   * Example:
   *
   * ```javascript
   * MyModel.removeObserver('before save', function removedObserver(ctx, next) {
   *   // some logic user want to apply to the removed observer...
   *   next();
   * });
   * ```
   *
   * @param {String} operation The operation name.
   * @callback {function} listener The listener function.
   * @end
   */
  static removeObserver<T extends typeof ModelBase>(
    this: T,
    operation: string,
    listener: Listener<OperationHookContext<T>>,
  ): Listener<OperationHookContext<T>> | undefined;

  /**
   * Unregister all asynchronous observers for the given operation (event).
   *
   * Example:
   *
   * Remove all observers connected to the `before save` operation.
   *
   * ```javascript
   * MyModel.clearObservers('before save');
   * ```
   *
   * @param {String} operation The operation name.
   * @end
   */
  static clearObservers(operation: string): void;

  getMergePolicy(options: ModelMergePolicyOptions): ModelMergePolicy;
}

export type ModelBaseClass = typeof ModelBase;

/**
 * An extension of the built-in Partial<T> type which allows partial values
 * in deeply nested properties too.
 */
export type DeepPartial<T> = {[P in keyof T]?: DeepPartial<T[P]>};

/**
 * Union export type for model instance or plain object representing the model
 * instance
 */
export type ModelData<T extends ModelBase = ModelBase> = T | DeepPartial<T>;
