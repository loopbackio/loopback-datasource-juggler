// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// Type definitions for loopback-datasource-juggler 3.x
// Project: https://github.com/strongloop/loopback-datasource-juggler
// Definitions by: Raymond Feng <https://github.com/raymondfeng>
// TypeScript Version: 2.8

/**
 * Experimental TypeScript definitions to capture types of the key artifacts
 * from `loopback-datasource-juggler` module. One of the main purposes is to
 * leverage such types in `LoopBack 4`'s bridge to juggler.
 *
 * Please note some of the classes, properties, methods, and functions are
 * intentionally not included in the definitions because of one of the following
 * factors:
 *
 * - They are internal
 * - They are to be deprecated
 */
export * from './types/common';
export * from './types/model';
export * from './types/relation';
export * from './types/query';
export * from './types/datasource';
export * from './types/kv-model';
export * from './types/persisted-model';
export * from './types/scope';
export * from './types/transaction-mixin';
export * from './types/relation-mixin';
export * from './types/observer-mixin';
export * from './types/validation-mixin';
export * from './types/inclusion-mixin';
export * from './types/connector';
