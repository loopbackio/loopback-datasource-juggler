// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Callback, DataSource, Options, PromiseOrVoid} from '..';

// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * Connector from `loopback-connector` module
 */
export interface Connector {
  name: string; // Name/type of the connector
  dataSource?: DataSource;
  connect(callback?: Callback): PromiseOrVoid; // Connect to the underlying system
  disconnect(callback?: Callback): PromiseOrVoid; // Disconnect from the underlying system
  ping(callback?: Callback): PromiseOrVoid; // Ping the underlying system
  execute?(...args: any[]): Promise<any>;
  [property: string]: any; // Other properties that vary by connectors
}

/**
 * Base connector class
 */
export declare class ConnectorBase implements Connector {
  name: string; // Name/type of the connector;
  dataSource?: DataSource;
  connect(callback?: Callback): PromiseOrVoid; // Connect to the underlying system
  disconnect(callback?: Callback): PromiseOrVoid; // Disconnect from the underlying system
  ping(callback?: Callback): PromiseOrVoid; // Ping the underlying system
  execute?(...args: any[]): Promise<any>;

  /**
   * Initialize the connector against the given data source
   *
   * @param {DataSource} dataSource The dataSource
   * @param {Function} [callback] The callback function
   */
  static initialize(dataSource: DataSource, callback?: Callback): void;

  constructor(settings?: Options);
}

export declare class Memory extends ConnectorBase {}

export declare class KeyValueMemoryConnector extends ConnectorBase {}

export declare class Transient extends ConnectorBase {}
