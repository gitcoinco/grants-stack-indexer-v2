import { promises as fs } from "fs";
import * as path from "path";
import { isNativeError } from "util/types";
import {
    FileMigrationProvider,
    Kysely,
    MigrationResult,
    Migrator,
    NO_MIGRATIONS,
    SchemaModule,
} from "kysely";

import { ILogger, stringify } from "@grants-stack-indexer/shared";

export interface MigrationConfig<T> {
    db: Kysely<T>;
    schema: string;
    migrationsFolder: string;
    domain: string;
}

/**
 * Since WithSchemaPlugin doesn't work with `sql.table`, we need to get the schema name manually.
 * ref: https://github.com/kysely-org/kysely/issues/761
 */
export const getSchemaName = (schema: SchemaModule): string => {
    let name = "public";
    schema.createTable("test").$call((b) => {
        name = b.toOperationNode().table.table.schema?.name ?? "public";
    });
    return name;
};

/**
 * Applies all available migrations to the database up to the latest version.
 *
 * This function ensures that the specified schema exists and then uses file-based migrations to update the
 * database. It creates a migrator using the provided database instance and migration configurations, including
 * dynamically constructed migration table names based on the given domain. Each migration's status is logged,
 * and in case of an error during the migration process, the error is logged and re-thrown.
 *
 * @param config - The migration configuration object.
 * @param config.db - The Kysely database instance used to execute migration queries.
 * @param config.schema - The name of the schema to apply migrations, which should match the database schema.
 * @param config.migrationsFolder - The folder path containing migration files.
 * @param config.domain - The domain string used to dynamically name the migration tables.
 * @param logger - The logger instance for logging migration statuses and errors.
 *
 * @returns A promise that resolves to an array of migration result objects if migrations are applied, or undefined otherwise.
 *
 * @throws If an error occurs during the migration process, the error is logged and thrown.
 */
export async function migrateToLatest<T>(
    config: MigrationConfig<T>,
    logger: ILogger,
): Promise<MigrationResult[] | undefined> {
    await config.db.schema.createSchema(config.schema).ifNotExists().execute();

    const migrator = new Migrator({
        db: config.db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: config.migrationsFolder,
        }),
        migrationTableSchema: config.schema,
        migrationTableName: `${config.domain}_migrations`,
        migrationLockTableName: `${config.domain}_migrations_lock`,
    });

    const { error, results } = await migrator.migrateToLatest();

    results?.forEach((it) => {
        if (it.status === "Success") {
            logger.info(`migration "${it.migrationName}" was executed successfully`);
        } else if (it.status === "Error") {
            logger.error(`failed to execute migration "${it.migrationName}"`);
        }
    });

    if (error) {
        logger.error("failed to migrate");
        logger.error(isNativeError(error) ? error : stringify(error));
        throw error;
    }

    return results;
}

/**
 * Resets the database by rolling back all applied migrations.
 *
 * This function initializes a Migrator with a file migration provider and reverts the database
 * state by rolling back all migrations. The migration and lock table names are dynamically constructed
 * using the provided domain (formatted as "<domain>_migrations" and "<domain>_migrations_lock").
 *
 * @param config - The migration configuration, including:
 *   - db: The Kysely database instance.
 *   - migrationsFolder: The folder path containing migration files.
 *   - domain: The domain used to namespace the migration tables.
 * @param logger - The logger instance for recording migration events and errors.
 * @returns A promise that resolves to an array of migration results if successful, or undefined.
 * @throws Will throw an error if the migration reset process encounters an issue.
 */
export async function resetDatabase<T>(
    config: MigrationConfig<T>,
    logger: ILogger,
): Promise<MigrationResult[] | undefined> {
    const migrator = new Migrator({
        db: config.db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: config.migrationsFolder,
        }),
        migrationTableName: `${config.domain}_migrations`,
        migrationLockTableName: `${config.domain}_migrations_lock`,
    });

    const { error, results } = await migrator.migrateTo(NO_MIGRATIONS);

    if (error) {
        logger.error("failed to reset database");
        logger.error(isNativeError(error) ? error : stringify(error));
        throw error;
    }

    return results;
}
