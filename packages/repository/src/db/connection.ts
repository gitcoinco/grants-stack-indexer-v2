import { CamelCasePlugin, ColumnType, Kysely, PostgresDialect, WithSchemaPlugin } from "kysely";
import pg from "pg";

import {
    Application,
    PendingProjectRole as PendingProjectRoleTable,
    PendingRoundRole as PendingRoundRoleTable,
    ProjectRole as ProjectRoleTable,
    Project as ProjectTable,
    RoundRole as RoundRoleTable,
    Round as RoundTable,
    StatusSnapshot,
} from "../internal.js";

const { Pool } = pg;

export interface DatabaseConfig extends pg.PoolConfig {
    connectionString: string;
    withSchema?: string;
}

type ApplicationTable = Omit<Application, "statusSnapshots"> & {
    statusSnapshots: ColumnType<
        StatusSnapshot[],
        StatusSnapshot[] | string,
        StatusSnapshot[] | string
    >;
};

export interface Database {
    rounds: RoundTable;
    pendingRoundRoles: PendingRoundRoleTable;
    roundRoles: RoundRoleTable;
    projects: ProjectTable;
    pendingProjectRoles: PendingProjectRoleTable;
    projectRoles: ProjectRoleTable;
    applications: ApplicationTable;
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
export const createKyselyPostgresDb = (config: DatabaseConfig): Kysely<Database> => {
    const dialect = new PostgresDialect({
        pool: new Pool({
            max: 15,
            idleTimeoutMillis: 30_000,
            keepAlive: true,
            connectionTimeoutMillis: 5_000,
            ...config,
        }),
    });

    const withSchema = config.withSchema ?? "public";

    return new Kysely<Database>({
        dialect,
        plugins: [new CamelCasePlugin(), new WithSchemaPlugin(withSchema)],
    });
};
