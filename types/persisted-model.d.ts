// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import { Callback, Options, PromiseOrVoid } from './common';
import { ModelBase, ModelData } from './model';
import { Filter, Where } from './query';

/**
 * Data object for persisted models
 */
export type PersistedData<
  T extends PersistedModel = PersistedModel
> = ModelData<T>;

/**
 * Type of affected count
 */
export interface Count {
  count: number;
}

/**
 * Persisted model
 */
export declare class PersistedModel extends ModelBase {
  /**
   * Create new instance of Model, and save to database.
   *
   * @param {Object|Object[]} [data] Optional data argument. Can be either a
   * single model instance or an array of instances.
   *
   * @callback {Function} callback Callback function called with `cb(err, obj)` signature.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} models Model instances or null.
   */
  static create(
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  static create(
    data: PersistedData[],
    options?: Options,
    callback?: Callback<PersistedModel[]>,
  ): PromiseOrVoid<PersistedModel[]>;

  /**
   * Creates an array of new instances of Model, and save to database in one DB query.
   *
   * @param {Object[]} [data] Optional data argument. An array of instances.
   *
   * @callback {Function} callback Callback function called with `cb(err, obj)` signature.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} models Model instances or null.
   */
  static createAll(
    data: PersistedData[],
    options?: Options,
    callback?: Callback<PersistedModel[]>,
  ): PromiseOrVoid<PersistedModel[]>;

  /**
   * Update or insert a model instance
   * @param {Object} data The model instance data to insert.
   * @callback {Function} callback Callback function called with `cb(err, obj)` signature.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} model Updated model instance.
   */
  static upsert(
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  static updateOrCreate(
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  static patchOrCreate(
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  /**
   * Update or insert a model instance based on the search criteria.
   * If there is a single instance retrieved, update the retrieved model.
   * Creates a new model if no model instances were found.
   * Returns an error if multiple instances are found.
   * @param {Object} [where]  `where` filter, like
   * ```
   * { key: val, key2: {gt: 'val2'}, ...}
   * ```
   * <br/>see
   * [Where filter](http://loopback.io/doc/en/lb2/Where-filter.html#where-clause-for-other-methods).
   * @param {Object} data The model instance data to insert.
   * @callback {Function} callback Callback function called with `cb(err, obj)` signature.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} model Updated model instance.
   */
  static upsertWithWhere(
    where: Where,
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  static patchOrCreateWithWhere(
    where: Where,
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  /**
   * Replace or insert a model instance; replace existing record if one is found,
   * such that parameter `data.id` matches `id` of model instance; otherwise,
   * insert a new record.
   * @param {Object} data The model instance data.
   * @options {Object} [options] Options for replaceOrCreate
   * @property {Boolean} validate Perform validation before saving.  Default is true.
   * @callback {Function} callback Callback function called with `cb(err, obj)` signature.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} model Replaced model instance.
   */
  static replaceOrCreate(
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  /**
   * Finds one record matching the optional filter object. If not found, creates
   * the object using the data provided as second argument. In this sense it is
   * the same as `find`, but limited to one object. Returns an object, not
   * collection. If you don't provide the filter object argument, it tries to
   * locate an existing object that matches the `data` argument.
   *
   * @options {Object} [filter] Optional Filter object; see below.
   * @property {String|Object|Array} fields Identify fields to include in return result.
   * <br/>See [Fields filter](http://loopback.io/doc/en/lb2/Fields-filter.html).
   * @property {String|Object|Array} include  See PersistedModel.include documentation.
   * <br/>See [Include filter](http://loopback.io/doc/en/lb2/Include-filter.html).
   * @property {Number} limit Maximum number of instances to return.
   * <br/>See [Limit filter](http://loopback.io/doc/en/lb2/Limit-filter.html).
   * @property {String} order Sort order: either "ASC" for ascending or "DESC" for descending.
   * <br/>See [Order filter](http://loopback.io/doc/en/lb2/Order-filter.html).
   * @property {Number} skip Number of results to skip.
   * <br/>See [Skip filter](http://loopback.io/doc/en/lb2/Skip-filter.html).
   * @property {Object} where Where clause, like
   * ```
   * {where: {key: val, key2: {gt: val2}, ...}}
   * ```
   * <br/>See
   * [Where filter](http://loopback.io/doc/en/lb2/Where-filter.html#where-clause-for-queries).
   * @param {Object} data Data to insert if object matching the `where` filter is not found.
   * @callback {Function} callback Callback function called with `cb(err, instance, created)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} instance Model instance matching the `where` filter, if found.
   * @param {Boolean} created True if the instance does not exist and gets created.
   */
  static findOrCreate(
    filter: Filter,
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<[PersistedModel, boolean]>;

  /**
   * Check whether a model instance exists in database.
   *
   * @param {id} id Identifier of object (primary key value).
   *
   * @callback {Function} callback Callback function called with `(err, exists)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Boolean} exists True if the instance with the specified ID exists; false otherwise.
   */
  static exists(
    id: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  /**
   * Find object by ID with an optional filter for include/fields.
   *
   * @param {*} id Primary key value
   * @options {Object} [filter] Optional Filter JSON object; see below.
   * @property {String|Object|Array} fields Identify fields to include in return result.
   * <br/>See [Fields filter](http://loopback.io/doc/en/lb2/Fields-filter.html).
   * @property {String|Object|Array} include  See PersistedModel.include documentation.
   * <br/>See [Include filter](http://loopback.io/doc/en/lb2/Include-filter.html).
   * @callback {Function} callback Callback function called with `(err, instance)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} instance Model instance matching the specified ID or null if no instance matches.
   */
  static findById(
    id: any,
    filter?: Filter,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<PersistedModel>;

  /**
   * Find all model instances that match `filter` specification.
   * See [Querying models](http://loopback.io/doc/en/lb2/Querying-data.html).
   *
   * @options {Object} [filter] Optional Filter JSON object; see below.
   * @property {String|Object|Array} fields Identify fields to include in return result.
   * <br/>See [Fields filter](http://loopback.io/doc/en/lb2/Fields-filter.html).
   * @property {String|Object|Array} include  See PersistedModel.include documentation.
   * <br/>See [Include filter](http://loopback.io/doc/en/lb2/Include-filter.html).
   * @property {Number} limit Maximum number of instances to return.
   * <br/>See [Limit filter](http://loopback.io/doc/en/lb2/Limit-filter.html).
   * @property {String} order Sort order: either "ASC" for ascending or "DESC" for descending.
   * <br/>See [Order filter](http://loopback.io/doc/en/lb2/Order-filter.html).
   * @property {Number} skip Number of results to skip.
   * <br/>See [Skip filter](http://loopback.io/doc/en/lb2/Skip-filter.html).
   * @property {Object} where Where clause, like
   * ```
   * { where: { key: val, key2: {gt: 'val2'}, ...} }
   * ```
   * <br/>See
   * [Where filter](http://loopback.io/doc/en/lb2/Where-filter.html#where-clause-for-queries).
   *
   * @callback {Function} callback Callback function called with `(err, returned-instances)` arguments.    Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Array} models Model instances matching the filter, or null if none found.
   */

  static find(
    filter?: Filter,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel[]>;

  /**
   * Find one model instance that matches `filter` specification.
   * Same as `find`, but limited to one result;
   * Returns object, not collection.
   *
   * @options {Object} [filter] Optional Filter JSON object; see below.
   * @property {String|Object|Array} fields Identify fields to include in return result.
   * <br/>See [Fields filter](http://loopback.io/doc/en/lb2/Fields-filter.html).
   * @property {String|Object|Array} include  See PersistedModel.include documentation.
   * <br/>See [Include filter](http://loopback.io/doc/en/lb2/Include-filter.html).
   * @property {String} order Sort order: either "ASC" for ascending or "DESC" for descending.
   * <br/>See [Order filter](http://loopback.io/doc/en/lb2/Order-filter.html).
   * @property {Number} skip Number of results to skip.
   * <br/>See [Skip filter](http://loopback.io/doc/en/lb2/Skip-filter.html).
   * @property {Object} where Where clause, like
   * ```
   * {where: { key: val, key2: {gt: 'val2'}, ...} }
   * ```
   * <br/>See
   * [Where filter](http://loopback.io/doc/en/lb2/Where-filter.html#where-clause-for-queries).
   *
   * @callback {Function} callback Callback function called with `(err, returned-instance)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Array} model First model instance that matches the filter or null if none found.
   */
  static findOne(
    filter?: Filter,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  /**
   * Destroy all model instances that match the optional `where` specification.
   *
   * @param {Object} [where] Optional where filter, like:
   * ```
   * {key: val, key2: {gt: 'val2'}, ...}
   * ```
   * <br/>See
   * [Where filter](http://loopback.io/doc/en/lb2/Where-filter.html#where-clause-for-other-methods).
   *
   * @callback {Function} callback Optional callback function called with `(err, info)` arguments.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} info Additional information about the command outcome.
   * @param {Number} info.count Number of instances (rows, documents) destroyed.
   */
  static destroyAll(
    where?: Where,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  static remove(
    where?: Where,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  static deleteAll(
    where?: Where,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  /**
   * Update multiple instances that match the where clause.
   *
   * Example:
   *
   *```js
   * Employee.updateAll({managerId: 'x001'}, {managerId: 'x002'}, function(err, info) {
   *     ...
   * });
   * ```
   *
   * @param {Object} [where] Optional `where` filter, like
   * ```
   * { key: val, key2: {gt: 'val2'}, ...}
   * ```
   * <br/>see
   * [Where filter](http://loopback.io/doc/en/lb2/Where-filter.html#where-clause-for-other-methods).
   * @param {Object} data Object containing data to replace matching instances, if AnyType.
   *
   * @callback {Function} callback Callback function called with `(err, info)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} info Additional information about the command outcome.
   * @param {Number} info.count Number of instances (rows, documents) updated.
   *
   */
  static updateAll(
    where?: Where,
    data?: PersistedData,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  static update(
    where?: Where,
    data?: PersistedData,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  /**
   * Destroy model instance with the specified ID.
   * @param {*} id The ID value of model instance to delete.
   * @callback {Function} callback Callback function called with `(err)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   */
  static destroyById(
    id: any,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  static removeById(
    id: any,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  static deleteById(
    id: any,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  /**
   * Replace attributes for a model instance whose id is the first input
   * argument and persist it into the datasource.
   * Performs validation before replacing.
   *
   * @param {*} id The ID value of model instance to replace.
   * @param {Object} data Data to replace.
   * @options {Object} [options] Options for replace
   * @property {Boolean} validate Perform validation before saving.  Default is true.
   * @callback {Function} callback Callback function called with `(err, instance)` arguments.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} instance Replaced instance.
   */
  static replaceById(
    id: any,
    data: PersistedData,
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  /**
   * Return the number of records that match the optional "where" filter.
   * @param {Object} [where] Optional where filter, like
   * ```
   * { key: val, key2: {gt: 'val2'}, ...}
   * ```
   * <br/>See
   * [Where filter](http://loopback.io/doc/en/lb2/Where-filter.html#where-clause-for-other-methods).
   * @callback {Function} callback Callback function called with `(err, count)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Number} count Number of instances.
   */
  static count(
    where?: Where,
    options?: Options,
    callback?: Callback<number>,
  ): PromiseOrVoid<number>;

  /**
   * Save model instance. If the instance doesn't have an ID, then calls [create](#persistedmodelcreatedata-cb) instead.
   * Triggers: validate, save, update, or create.
   * @options {Object} [options] See below.
   * @property {Boolean} validate Perform validation before saving.  Default is true.
   * @property {Boolean} throws If true, throw a validation error; WARNING: This can crash Node.
   * If false, report the error via callback.  Default is false.
   * @callback {Function} callback Optional callback function called with `(err, obj)` arguments.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} instance Model instance saved or created.
   */
  save(options?: Options, callback?: Callback<boolean>): PromiseOrVoid<boolean>;

  /**
   * Determine if the data model is new.
   * @returns {Boolean} Returns true if the data model is new; false otherwise.
   */
  isNewRecord(): boolean;

  /**
   * Deletes the model from persistence.
   * Triggers `destroy` hook (async) before and after destroying object.
   * @param {Function} callback Callback function.
   */
  destroy(
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  remove(
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  delete(
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  /**
   * Update a single attribute.
   * Equivalent to `updateAttributes({name: 'value'}, cb)`
   *
   * @param {String} name Name of property.
   * @param {Mixed} value Value of property.
   * @callback {Function} callback Callback function called with `(err, instance)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} instance Updated instance.
   */
  updateAttribute(
    name: string,
    value: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  /**
   * Update set of attributes.  Performs validation before updating.
   *
   * Triggers: `validation`, `save` and `update` hooks
   * @param {Object} data Data to update.
   * @callback {Function} callback Callback function called with `(err, instance)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} instance Updated instance.
   */
  updateAttributes(
    data: PersistedData,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  /**
   * Replace attributes for a model instance and persist it into the datasource.
   * Performs validation before replacing.
   *
   * @param {Object} data Data to replace.
   * @options {Object} [options] Options for replace
   * @property {Boolean} validate Perform validation before saving.  Default is true.
   * @callback {Function} callback Callback function called with `(err, instance)` arguments.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} instance Replaced instance.
   */
  replaceAttributes(
    data: PersistedData,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  /**
   * Reload object from persistence.  Requires `id` member of `object` to be able to call `find`.
   * @callback {Function} callback Callback function called with `(err, instance)` arguments.  Required.
   * @param {Error} err Error object; see [Error object](http://loopback.io/doc/en/lb2/Error-object.html).
   * @param {Object} instance Model instance.
   */
  reload(
    options?: Options,
    callback?: Callback<PersistedModel>,
  ): PromiseOrVoid<PersistedModel>;

  /**
   * Set the correct `id` property for the `PersistedModel`. Uses the `setId` method if the model is attached to
   * connector that defines it.  Otherwise, uses the default lookup.
   * Override this method to handle complex IDs.
   *
   * @param {*} val The `id` value. Will be converted to the export type that the `id` property specifies.
   */
  setId(val: any): void;

  /**
   * Get the `id` value for the `PersistedModel`.
   *
   * @returns {*} The `id` value
   */

  getId(): any;

  /**
   * Get the `id` property name of the constructor.
   *
   * @returns {String} The `id` property name
   */

  getIdName(): string;

  /**
   * Get the `id` property name of the constructor.
   *
   * @returns {String} The `id` property name
   */
  static getIdName(): string;
}

export type PersistedModelClass = typeof PersistedModel;
