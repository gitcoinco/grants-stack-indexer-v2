import {
    CamelCasePlugin,
    ColumnType,
    Generated,
    Kysely,
    PostgresDialect,
    WithSchemaPlugin,
} from "kysely";
import pg from "pg";

import { ILogger } from "@grants-stack-indexer/shared";

import {
    Application,
    ApplicationPayout,
    Donation as DonationTable,
    ProcessedEvent as EventRegistryTable,
    MatchingDistribution,
    Metadata as MetadataCacheTable,
    PendingProjectRole as PendingProjectRoleTable,
    PendingRoundRole as PendingRoundRoleTable,
    Price as PriceCacheTable,
    ProjectRole as ProjectRoleTable,
    Project as ProjectTable,
    Round,
    RoundRole as RoundRoleTable,
    StatusSnapshot,
    StrategyProcessingCheckpoint as StrategyProcessingCheckpointTable,
    Strategy as StrategyRegistryTable,
} from "../internal.js";

const { Pool } = pg;

export interface DatabaseConfig extends pg.PoolConfig {
    connectionString: string;
    /**
     * Whether the database is in production mode. If true, SSL is enabled.
     *
     * @default false
     */
    isProduction: boolean;
    withSchema?: string;
}

type ApplicationTable = Omit<Application, "statusSnapshots"> & {
    statusSnapshots: ColumnType<
        StatusSnapshot[],
        StatusSnapshot[] | string,
        StatusSnapshot[] | string
    >;
};

type RoundTable = Omit<Round, "matchingDistribution"> & {
    matchingDistribution: ColumnType<
        MatchingDistribution[] | null,
        MatchingDistribution[] | string | null,
        MatchingDistribution[] | string | null
    >;
};

type ApplicationPayoutTable = Omit<ApplicationPayout, "id"> & {
    id: Generated<number>;
};

export interface Database {
    rounds: RoundTable;
    pendingRoundRoles: PendingRoundRoleTable;
    roundRoles: RoundRoleTable;
    projects: ProjectTable;
    pendingProjectRoles: PendingProjectRoleTable;
    projectRoles: ProjectRoleTable;
    applications: ApplicationTable;
    donations: DonationTable;
    applicationsPayouts: ApplicationPayoutTable;
    strategiesRegistry: StrategyRegistryTable;
    eventsRegistry: EventRegistryTable;
    strategyProcessingCheckpoints: StrategyProcessingCheckpointTable;
    metadataCache: MetadataCacheTable;
    priceCache: PriceCacheTable;
}

/**
 * Creates and configures a Kysely database instance for PostgreSQL.
 *
 * @param config - The database configuration object extending PoolConfig.
 * @param config.connectionString - The connection string for the database.
 * @param config.withSchema - The schema to use for the database. Defaults to `public`.
 * @returns A configured Kysely instance for the Database.
 *
 * This function sets up a PostgreSQL database connection using Kysely ORM.
 *
 * It uses the `CamelCasePlugin` to convert all table names to camel case.
 * It uses the `WithSchemaPlugin` to automatically prefix all table names with the schema name on queries.
 *
 * @example
 * const dbConfig: DatabaseConfig = {
 *   connectionString: 'postgresql://user:password@localhost:5432/mydb'
 * };
 * const db = createKyselyDatabase(dbConfig);
 */
export const createKyselyPostgresDb = (
    config: DatabaseConfig,
    logger: ILogger,
): Kysely<Database> => {
    const dialect = new PostgresDialect({
        pool: new Pool({
            max: 15,
            idleTimeoutMillis: 30_000,
            keepAlive: true,
            connectionTimeoutMillis: 5_000,
            ssl: config.isProduction
                ? {
                      rejectUnauthorized: false,
                  }
                : undefined,
            ...config,
        }),
    });

    const withSchema = config.withSchema ?? "public";

    return new Kysely<Database>({
        dialect,
        plugins: [new CamelCasePlugin(), new WithSchemaPlugin(withSchema)],
        log(event): void {
            if (event.level === "error") {
                logger.error(
                    `Query failed. SQL: ${event.query.sql} with params: ${event.query.parameters}`,
                    {
                        durationMs: event.queryDurationMillis,
                        error: event.error,
                    },
                );
            }
        },
    });
};
