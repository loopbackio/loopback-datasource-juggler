// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {PersistedData, PersistedModel} from '..';
import {Callback, Options, PromiseOrVoid} from './common';
import {Inclusion} from './query';

/**
 * Inclusion mixin
 */
export interface InclusionMixin {
  /**
   * Enables you to load relations of several objects and optimize numbers of requests.
   *
   * Examples:
   *
   * Load all users' posts with only one additional request:
   * `User.include(users, 'posts', function() {});`
   * Or
   * `User.include(users, ['posts'], function() {});`
   *
   * Load all users posts and passports with two additional requests:
   * `User.include(users, ['posts', 'passports'], function() {});`
   *
   * Load all passports owner (users), and all posts of each owner loaded:
   *```Passport.include(passports, {owner: 'posts'}, function() {});
   *``` Passport.include(passports, {owner: ['posts', 'passports']});
   *``` Passport.include(passports, {owner: [{posts: 'images'}, 'passports']});
   *
   * @param {Array} objects Array of instances
   * @param {String|Object|Array} include Which relations to load.
   * @param {Object} [options] Options for CRUD
   * @param {Function} cb Callback called when relations are loaded
   *
   */
  include<T extends PersistedModel>(
    objects: PersistedData<T>[],
    include: Inclusion,
    options?: Options,
    callback?: Callback<PersistedData<T>[]>,
  ): PromiseOrVoid<PersistedData<T>[]>;
}
