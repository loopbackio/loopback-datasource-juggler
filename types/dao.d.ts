import { Options } from "..";

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
