import type {ConnectorSettings} from './connector'
// import type {DataAccessObject} from './dao';
import type {ModelSettings} from './model';

/**
 * Settings made available by {@link ModelUtils} mixin.
 *
 * @remarks
 * When the mixin is applied, these options can be set in
 * {@link DataAccessObject} query method-level options, {@link ModelSettings},
 * and {@link ConnectorSettings} in descending precedence.
 */
export interface ModelUtilsOptions {
    /**
     * Sets if non-standard {@link Where} operators are permitted in passed
     * {@link Filter}.
     */
    allowExtendedOperators?: boolean;
    maxDepthOfQuery?: number;
    maxDepthOfData?: number;
    prohibitHiddenPropertiesInQuery?: boolean;
    normalizeUndefinedInQuery?: boolean;

    // Cassandra-specific
    clusteringKeys?: string[]
    // END Cassandra-specific
}
