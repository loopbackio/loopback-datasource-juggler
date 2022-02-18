/**
 * Opt-out unless stated otherwise
 */
export interface ConnectorCapabilities {
    ilike?: boolean;
    nilike?: boolean;
    supportsArrays?: boolean;
    supportInq?: boolean;
    geoPoint?: boolean;
    supportForceId?: boolean;
    nestedProperty?: boolean;
    nullDataValueExists?: boolean;
    supportPagination?: boolean;
    adhocSort?: boolean; // Mostly opt-out
    supportOrOperator?: boolean;
    cloudantCompatible?: boolean;
    ignoreUndefinedConditionValue?: boolean;
    supportTwoOrMoreInq?: boolean;
    refuseDuplicateInsert?: boolean;
    reportDeletedCount?: boolean;
    deleteWithOtherThanId?: boolean;
    updateWithOtherThanId?: boolean;
    supportStrictDelete?: boolean;
    atomicUpsertWithWhere?: boolean;
    replaceOrCreateReportsNewInstance?: boolean;
    updateWithoutId?: boolean; // This is a separate entry from `supportUpdateWithoutId`
    supportUpdateWithoutId?: boolean;
    supportInclude?: boolean; // Opt-in
    canExpire?: boolean; // KVAO test suite
    canIterateKeys?: boolean; // KAVO test suite
    canIterateLargeKeySets?: boolean // KVAO test suite
    canQueryTtl?: boolean // KVAO test suite
    ttlPrecision?: number; // KVAO test suite; Defaults to `10`.
}
