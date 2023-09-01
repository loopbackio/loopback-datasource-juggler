import { Callback } from '../common';
import {ConnectorInitialize, SchemaDiscoveryOptions, ConnectorSettings} from '../connector'
import { DataAccessObject } from '../dao';
import { DataSource } from '../datasource';
import { ModelBase, Schema } from '../model';
import {Connector} from 'loopback-connector';

export let initialize: ConnectorInitialize;

export interface TransientConnectorSettings extends ConnectorSettings {
  generateId?: TransientConnectorGenerateId,
  defaultIdType?: object,
}

export type TransientConnectorGenerateId = (model: string, data?: unknown, idName?: string) => string;

export declare class Transient extends Connector {
  isTransaction: boolean;
  constructor(m: Transient | null, settings?: TransientConnectorSettings);
  onTransactionExec?: Callback<void>;
  generateId: TransientConnectorGenerateId;
  flush<T extends any>(action: unknown, result?: T, callback?: Callback<T>): void;
  exec(callback: Callback<void>): void;
  transaction(): Transient;
}
