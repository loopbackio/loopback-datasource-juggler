// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {AnyObject, Callback, Options, PromiseOrVoid} from './common';
import {ModelBase, ModelBaseClass, ModelData} from './model';
import {Count} from './persisted-model';
import {Filter, Where} from './query';

/**
 * Definition metadata for scopes
 */
export declare class ScopeDefinition {
  constructor(definition: AnyObject);

  isStatic: boolean;
  modelFrom?: ModelBaseClass;
  modelTo?: ModelBaseClass;
  name: string;
  params?: AnyObject;
  methods?: AnyObject<Function>;
  options?: Options;

  targetModel(receiver: ModelBaseClass | (() => ModelBaseClass)): void;

  /**
   * Find related model instances
   * @param {*} receiver The target model class/prototype
   * @param {Object|Function} scopeParams
   * @param {Boolean|Object} [condOrRefresh] true for refresh or object as a filter
   * @param {Object} [options]
   * @param {Function} cb
   * @returns {*}
   */
  related(
    receiver: ModelBaseClass | (() => ModelBaseClass),
    scopeParams: AnyObject | (() => AnyObject),
    condOrRefresh: boolean | AnyObject,
    options?: Options,
    callback?: Callback,
  ): PromiseOrVoid;

  /**
   * Define a scope method
   * @param {String} name of the method
   * @param {Function} function to define
   */
  defineMethod(name: string, fn: Function): Function;
}

/**
 * Define a scope to the class
 * @param {Model} cls The class where the scope method is added
 * @param {Model} targetClass The class that a query to run against
 * @param {String} name The name of the scope
 * @param {Object|Function} params The parameters object for the query or a function
 * to return the query object
 * @param methods An object of methods keyed by the method name to be bound to the class
 */
export declare function defineScope(
  cls: ModelBaseClass,
  targetClass: ModelBaseClass,
  name: string,
  params: AnyObject,
  methods: AnyObject<Function>,
  options?: Options,
): ScopeDefinition;

/**
 * Methods injected by scopes
 */
export interface ScopedMethods<T extends ModelBase = ModelBase> {
  build(data: ModelData<T>): T;

  create(
    data: ModelData<T>,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  destroyAll(
    where?: Where,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  updateAll(
    where?: Where,
    data?: ModelData<T>,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  findById(
    id: any,
    filter: Filter,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  findOne(
    filter: Filter,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  count(
    where: Where,
    options?: Options,
    callback?: Callback<number>,
  ): PromiseOrVoid<number>;
}
