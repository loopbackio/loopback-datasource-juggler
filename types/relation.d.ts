// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {AnyObject, Callback, Options, PromiseOrVoid} from './common';
import {ModelData} from './model';
import {
  Count,
  PersistedData,
  PersistedModel,
  PersistedModelClass,
} from './persisted-model';
import {Filter, Where} from './query';

/**
 * Relation types
 */
export enum RelationType {
  belongsTo = 'belongsTo',
  hasMany = 'hasMany',
  hasOne = 'hasOne',
  hasAndBelongsToMany = 'hasAndBelongsToMany',
  referencesMany = 'referencesMany',
  embedsOne = 'embedsOne',
  embedsMany = 'embedsMany',
}

/**
 * Relation definition
 */
export declare class RelationDefinition {
  name: string;
  type: RelationType;
  modelFrom: PersistedModelClass | string;
  keyFrom: string;
  modelTo: PersistedModelClass | string;
  keyTo: string;
  polymorphic: AnyObject | boolean;
  modelThrough?: PersistedModelClass | string;
  keyThrough?: string;
  multiple: boolean;
  properties: AnyObject;
  options: Options;
  scope: AnyObject;
  embed?: boolean;
  methods?: AnyObject<Function>;

  toJSON(): AnyObject;
  defineMethod(name: string, fn: Function): Function;
  applyScope(modelInstance: PersistedData, filter: Filter): void;
  applyProperties(modelInstance: PersistedData, obj: AnyObject): void;
}

/**
 * Relation of a given model instance
 */
export declare class Relation<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> {
  constructor(definition: RelationDefinition, modelInstance: S);

  resetCache(cache: T): void;
  getCache(): AnyObject<T>;
  callScopeMethod(methodName: string, ...args: any[]): any;
  fetch(
    condOrRefresh: boolean | AnyObject,
    options?: Options,
    callback?: Callback<T | T[]>,
  ): PromiseOrVoid<T | T[]>;
}

export declare class BelongsTo<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> extends Relation<S, T> {
  create(
    targetModelData: PersistedData<T>,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  build(targetModelData: PersistedData<T>): T;

  update(
    targetModelData: PersistedData<T>,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  destroy(
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  related(
    condOrRefresh: boolean | AnyObject,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  get(options?: Options, callback?: Callback<T>): PromiseOrVoid<T>;
}

export declare class HasMany<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> extends Relation<S, T> {
  removeFromCache(id: any): T | null;

  addToCache(inst: T): void;

  findById(
    fkId: any,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  exists(
    fkId: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  updateById(
    fkId: any,
    data: ModelData,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  destroyById(
    fkId: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;
}

export declare class HasManyThrough<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> extends Relation<S, T> {
  findById(
    fkId: any,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  destroyById(
    fkId: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  create(
    data: PersistedData<T>,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  add(
    acInst: any,
    data: PersistedData<T>,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  exists(
    acInst: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  remove(
    acInst: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;
}

export declare class HasOne<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> extends Relation<S, T> {
  create(
    targetModelData: PersistedData<T>,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  update(
    targetModelData: PersistedData<T>,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  destroy(
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  build(targetModelData: PersistedData<T>): T;

  related(
    condOrRefresh: any,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  get(options?: Options, callback?: Callback<T>): PromiseOrVoid<T>;
}

export declare class HasAndBelongsToMany<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> extends Relation<S, T> {}

export declare class ReferencesMany<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> extends Relation<S, T> {
  related(
    receiver: PersistedModelClass,
    scopeParams: AnyObject,
    condOrRefresh: any,
    options?: Options,
    callback?: Callback<ModelData>,
  ): PromiseOrVoid<ModelData>;

  findById(
    fkId: any,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  exists(
    fkId: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  updateById(
    fkId: any,
    data: PersistedData<T>,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  destroyById(
    fkId: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  at(
    index: number,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  create(
    targetModelData: PersistedData<T>,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  build(targetModelData: PersistedData<T>): T;

  add(
    acInst: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  remove(
    acInst: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;
}

export declare class EmbedsOne<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> extends Relation<S, T> {
  related(
    condOrRefresh: any,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  prepareEmbeddedInstance(inst: T): void;

  embeddedValue(modelInstance: S): T;

  create(
    targetModelData: PersistedData<T>,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  build(targetModelData: PersistedData<T>): T;

  update(
    targetModelData: PersistedData<T>,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  destroy(
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;
}

export declare class EmbedsMany<
  S extends PersistedModel = PersistedModel,
  T extends PersistedModel = PersistedModel
> extends Relation<S, T> {
  prepareEmbeddedInstance(inst: T): void;

  embeddedList(modelInstance: T[]): void;

  embeddedValue(modelInstance: S): T[];

  related(
    receiver: PersistedModelClass,
    scopeParams: AnyObject,
    condOrRefresh: any,
    options?: Options,
    callback?: Callback<ModelData>,
  ): PromiseOrVoid<ModelData>;

  findById(
    fkId: any,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  get(
    fkId: any,
    options?: Options,
    callback?: Callback<ModelData>,
  ): PromiseOrVoid<ModelData>;

  exists(
    fkId: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  updateById(
    fkId: any,
    data: PersistedData<T>,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  set(
    fkId: any,
    data: PersistedData<T>,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  destroyById(
    fkId: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  unset(
    fkId: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  destroyAll(
    where: Where,
    options?: Options,
    callback?: Callback<Count>,
  ): PromiseOrVoid<Count>;

  at(index: number, callback?: Callback<T>): PromiseOrVoid<T>;

  create(
    targetModelData: PersistedData<T>,
    options?: Options,
    callback?: Callback<T>,
  ): PromiseOrVoid<T>;

  build(targetModelData: PersistedData<T>): T;

  add(
    acInst: any,
    data: PersistedData<T>,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;

  remove(
    acInst: any,
    options?: Options,
    callback?: Callback<boolean>,
  ): PromiseOrVoid<boolean>;
}
