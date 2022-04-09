import { Callback } from '../common';
import {ConnectorInitialize, Connector, SchemaDiscoveryOptions, ConnectorSettings} from '../connector'
import { DataAccessObject } from '../dao';
import { DataSource } from '../datasource';
import { ModelBase, Schema } from '../model';

export let initialize: ConnectorInitialize;

export interface TransientConnectorSettings extends ConnectorSettings {
  generateId?: TransientConnectorGenerateId,
  defaultIdType?: object,
}

export type TransientConnectorGenerateId = (model: string, data?: unknown, idName?: string) => string;

// export declare class Transient implements Connector {
//   isTransaction: boolean;
//   constructor(m: Transient | null, settings?: ConnectorSettings);
//   onTransactionExec?: Callback<void>;
//   generateId: TransientConnectorGenerateId;
//   flush<T extends any>(action: unknown, result?: T, callback?: Callback<T>): void;
//   exec(callback: Callback<void>): void;
//   transaction(): Transient;
// }
