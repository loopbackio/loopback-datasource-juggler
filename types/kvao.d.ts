import { AnyObject, Callback, Options } from "./common";
import { Connector } from "./connector";

export interface MatchFilter {
    match?: string;
}

export declare interface KeyValueAccessObject<CT extends Connector = Connector> {
    delete(key: string, callback?: Callback): Promise<AnyObject> | undefined;
    delete(key: string, options?: Options, callback?: Callback): Promise<AnyObject> | undefined;

    deleteAll(callback?: Callback): Promise<AnyObject> | undefined;
    deleteAll(options?: Options, callback?: Callback): Promise<AnyObject> | undefined;

    get(key: string, callback?: Callback): Promise<AnyObject> | undefined;
    get(key: string, options?: Options, callback?: Callback): Promise<AnyObject> | undefined;

    set(key: string, value: unknown, callback?: Callback): Promise<AnyObject> | undefined;
    set(key: string, value: unknown, options?: Options, callback?: Callback): Promise<AnyObject> | undefined;

    expire(key: string, ttl: number, callback?: Callback): Promise<AnyObject> | undefined;
    expire(key: string, ttl: number, options?: Options, callback?: Callback): Promise<AnyObject> | undefined;

    ttl(key: string, callback?: Callback): Promise<AnyObject> | undefined;
    ttl(key: string, options?: Options, callback?: Callback): Promise<AnyObject> | undefined;

    iterateKeys(options: Options): Promise<AnyObject> | undefined;
    iterateKeys(filter: MatchFilter, options: Options): Promise<AnyObject> | undefined;

    keys(callback?: Callback): Promise<AnyObject> | undefined;
    keys(options?: Options, callback?: Callback): Promise<AnyObject> | undefined;
    keys(filter?: MatchFilter, options?: Options, callback?: Callback): Promise<AnyObject> | undefined;

    getConnector(): CT;
}
