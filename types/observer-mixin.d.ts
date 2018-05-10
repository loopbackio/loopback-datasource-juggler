// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Callback, PromiseOrVoid} from './common';

export type Listener = (ctx: object, next: (err?: any) => void) => void;

export interface ObserverMixin {
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
  observe(operation: string, listener: Listener): void;

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
  removeObserver(operation: string, listener: Listener): Listener | undefined;

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
  clearObservers(operation: string): void;

  /**
   * Invoke all async observers for the given operation(s).
   *
   * Example:
   *
   * Notify all async observers for the `before save` operation.
   *
   * ```javascript
   * var context = {
   *   Model: Model,
   *   instance: obj,
   *   isNewInstance: true,
   *   hookState: hookState,
   *   options: options,
   * };
   * Model.notifyObserversOf('before save', context, function(err) {
   *  if (err) return cb(err);
   *  // user can specify the logic after the observers have been notified
   * });
   * ```
   *
   * @param {String|String[]} operation The operation name(s).
   * @param {Object} context Operation-specific context.
   * @callback {function(Error=)} callback The callback to call when all observers
   *   have finished.
   */
  notifyObserversOf(
    operation: string,
    context: object,
    callback?: Callback,
  ): PromiseOrVoid;

  _notifyBaseObservers(
    operation: string,
    context: object,
    callback?: Callback,
  ): PromiseOrVoid;

  /**
   * Run the given function with before/after observers.
   *
   * It's done in three serial asynchronous steps:
   *
   * - Notify the registered observers under 'before ' + operation
   * - Execute the function
   * - Notify the registered observers under 'after ' + operation
   *
   * If an error happens, it fails first and calls the callback with err.
   *
   * Example:
   *
   * ```javascript
   * var context = {
   *   Model: Model,
   *  instance: obj,
   *  isNewInstance: true,
   *  hookState: hookState,
   *  options: options,
   * };
   * function work(done) {
   *   process.nextTick(function() {
   *     done(null, 1);
   *   });
   * }
   * Model.notifyObserversAround('execute', context, work, function(err) {
   *   if (err) return cb(err);
   *   // user can specify the logic after the observers have been notified
   * });
   * ```
   *
   * @param {String} operation The operation name
   * @param {Context} context The context object
   * @param {Function} fn The task to be invoked as fn(done) or fn(context, done)
   * @callback {Function} callback The callback function
   * @returns {*}
   */
  notifyObserversAround(
    operation: string,
    context: object,
    fn: Function,
    callback?: Callback,
  ): PromiseOrVoid;
}
