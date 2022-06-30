import { AnyObject } from "strong-globalize/lib/config";
import { Options } from "..";
import { Connector } from "./connector";
import { Filter } from "./query";

export interface DaoDmlOptions extends Options {
    validate?: boolean;
    notify?: boolean;
}

export interface DaoUpsertOptions extends DaoDmlOptions {
    validateUpsert?: boolean;
}

export interface DaoUpdateOptions extends DaoDmlOptions {
    validateUpdate?: boolean;
}

export declare class DataAccessObject {
  private __persisted: boolean;
  private static _forDB(data: AnyObject): unknown;
  static defaultScope(target: AnyObject, inst: AnyObject): AnyObject;
  static applyScope(query: Filter, inst: AnyObject): AnyObject;
  // static applyProperties()
  static lookupModel(data?: unknown): DataAccessObject;
  static getConnector<T extends Connector = Connector>(): T;
  isNewRecord(): boolean;
}
