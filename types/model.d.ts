// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {EventEmitter} from 'events';
import {AnyObject, Options} from './common';
import {DataSource} from './datasource';

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
  name: string;
  type?: PropertyType;
}

/**
 * Schema definition
 */
export interface Schema {
  name: string;
  properties: {[property: string]: PropertyDefinition};
  settings?: AnyObject;
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
 * Model definition
 */
export declare class ModelDefinition extends EventEmitter implements Schema {
  name: string;
  properties: AnyObject;
  rawProperties: AnyObject;
  settings?: AnyObject;
  relations?: AnyObject[];

  constructor(
    modelBuilder: ModelBuilder | null | undefined,
    name: string,
    properties?: {[name: string]: PropertyDefinition},
    settings?: AnyObject,
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
}

export type ModelBaseClass = typeof ModelBase;

export declare class ModelBuilder extends EventEmitter {
  static defaultInstance: ModelBuilder;

  models: {[name: string]: ModelBaseClass};
  definitions: {[name: string]: ModelDefinition};
  settings: AnyObject;

  getModel(name: string, forceCreate?: boolean): ModelBaseClass;

  getModelDefinition(name: string): ModelDefinition | undefined;

  define(
    className: string,
    properties?: AnyObject,
    settings?: AnyObject,
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
