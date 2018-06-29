// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * Objects with open properties
 */
export interface AnyObject<T = any> {
  [property: string]: T;
}

/**
 * Type alias for options object
 */
export type Options = AnyObject<any>;

/**
 * Type alias for Node.js callback functions
 */
export type Callback<T = any> = (err?: any | null, result?: T) => void;

/**
 * Return export type for promisified Node.js async methods.
 *
 * Note that juggler uses Bluebird, not the native Promise.
 */
export type PromiseOrVoid<T = any> = PromiseLike<T> | void;
