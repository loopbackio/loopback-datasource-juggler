// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * Operators for where clauses
 */
export declare enum Operators {
  /**
   * Equal operator (=)
   */
  eq = 'eq',
  /**
   * Not equal operator (!=)
   */
  neq = 'neq',
  /**
   * Greater than operator (>)
   */
  gt = 'gt',
  /**
   * Greater than or equal operator (>=)
   */
  gte = 'gte',
  /**
   * Less than operator (<)
   */
  lt = 'lt',
  /**
   * Less than or equal (<=)
   */
  lte = 'lte',
  /**
   * IN operator. For example, `{type: {inq: ['a', 'b', 'c']}}`
   */
  inq = 'inq',
  /**
   * Between operator. For example, `{age: {between: [18, 40]}}`
   */
  between = 'between',
  /**
   * Exists operator
   */
  exists = 'exists',
  /**
   * AND operator
   */
  and = 'and',
  /**
   * OR operator
   */
  or = 'or',
}

/**
 * Matching criteria
 */
export interface Condition {
  eq?: any;
  neq?: any;
  gt?: any;
  gte?: any;
  lt?: any;
  lte?: any;
  inq?: any[];
  between?: any[];
  exists?: boolean;
  and?: Where[];
  or?: Where[];
}

/**
 * Where object
 */
export interface Where {
  and?: Where[]; // AND
  or?: Where[]; // OR
  [property: string]: Condition | any;
}

/**
 * Selection of fields
 */
export interface Fields {
  [property: string]: boolean;
}

/**
 * Inclusion of related items
 */
export interface Inclusion {
  relation: string;
  scope?: Filter;
}

/**
 * Query filter object
 */
export interface Filter {
  where?: Where;
  fields?: string | string[] | Fields;
  order?: string | string[];
  limit?: number;
  skip?: number;
  offset?: number;
  include?: string | string[] | Inclusion[];
}
