// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {EventEmitter} from 'events';
import {AnyObject, Options} from './common';
import {DataSource} from './datasource';
import {Listener, OperationHookContext} from './observer-mixin';

/**
 * Property types
 */
export type PropertyType =
  | string
  | Function
  | {[property: string]: PropertyType};

/**
 * Property definition
 */
export interface PropertyDefinition extends AnyObject {
  type?: PropertyType;
  id?: boolean | number;
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
  property: AnyObject;
}

/**
 * Index definition
 */
export interface IndexDefinition extends AnyObject {}

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
  [name: string]: PropertyDefinition
}

/**
 * Model settings, for example
 * ```ts
 * {
 *   strict: true,
 * }
 * ```
 */
export interface ModelSettings extends AnyObject {
  strict?: boolean;
  forceId?: boolean;
}

/**
 * Model definition
 */
export declare class ModelDefinition extends EventEmitter implements Schema {
  name: string;
  properties: ModelProperties;
  rawProperties: AnyObject;
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
  idName(): string;
  idNames(): string[];

  defineProperty(
    propertyName: string,
    propertyDefinition: PropertyDefinition,
  ): void;
  indexes(): {[name: string]: IndexDefinition};
  build(forceRebuild?: boolean): AnyObject;
  toJSON(forceRebuild?: boolean): AnyObject;
}

/**
 * Base class for LoopBack 3.x models
 */
export declare class ModelBase {
  static dataSource?: DataSource;
  static modelName: string;
  static definition: ModelDefinition;
  static readonly base: typeof ModelBase;

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
   * Checks if property is hidden.
   * @param {string} propertyName Property name
   * @returns {Boolean} true or false if hidden or not.
   */
  static isHiddenProperty(propertyName: string): boolean;

  /**
   * Checks if property is protected.
   * @param {string} propertyName Property name
   * @returns  {Boolean} true or false if protected or not.
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
  toObject(options?: Options): AnyObject;

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
}

export type ModelBaseClass = typeof ModelBase;

export declare class ModelBuilder extends EventEmitter {
  static defaultInstance: ModelBuilder;

  models: {[name: string]: ModelBaseClass};
  definitions: {[name: string]: ModelDefinition};
  settings: ModelSettings;

  defaultModelBaseClass: typeof ModelBase;

  getModel(name: string, forceCreate?: boolean): ModelBaseClass;

  getModelDefinition(name: string): ModelDefinition | undefined;

  define(
    className: string,
    properties?: ModelProperties,
    settings?: ModelSettings,
    parent?: ModelBaseClass,
  ): ModelBaseClass;

  defineProperty(
    modelName: string,
    propertyName: string,
    propertyDefinition: AnyObject,
  ): void;

  defineValueType(type: string, aliases?: string[]): void;

  extendModel(modelName: string, properties: AnyObject): void;

  getSchemaName(name?: string): string;

  resolveType(type: any): any;

  buildModels(
    schemas: AnyObject,
    createModel?: Function,
  ): {[name: string]: ModelBaseClass};

  buildModelFromInstance(
    name: string,
    json: AnyObject,
    options: Options,
  ): ModelBaseClass;
}

/**
 * An extension of the built-in Partial<T> type which allows partial values
 * in deeply nested properties too.
 */
export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]>; };

/**
 * Union export type for model instance or plain object representing the model
 * instance
 */
export type ModelData<T extends ModelBase = ModelBase> = T | DeepPartial<T>;
