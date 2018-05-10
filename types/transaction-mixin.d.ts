// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Callback, Options, PromiseOrVoid} from './common';

/**
 * Local transaction
 */
export interface Transaction {
  /**
   * Commit the transaction
   * @param callback
   */
  commit(callback?: Callback): PromiseOrVoid;
  /**
   * Rollback the transaction
   * @param callback
   */
  rollback(callback?: Callback): PromiseOrVoid;
}

/**
 * Isolation level
 */
export enum IsolationLevel {
  READ_COMMITTED = 'READ COMMITTED', // default
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  SERIALIZABLE = 'SERIALIZABLE',
  REPEATABLE_READ = 'REPEATABLE READ',
}

/**
 * Mixin for transaction support
 */
export interface TransactionMixin {
  /**
   * Begin a new transaction
   * @param options
   * @param callback
   */
  beginTransaction(
    options?: IsolationLevel | Options,
    callback?: Callback<Transaction>,
  ): PromiseOrVoid<Transaction>;
}
