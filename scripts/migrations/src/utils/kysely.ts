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
 * Applies all migrations to the database up to the latest version.
 *
 * @param config - The migration configuration.
 * @param config.db - The Kysely database instance.
 * @param config.schema - The schema to use for the migrations. Should be the same as the schema used in the Kysely database instance.
 * @returns The migration results.
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
 * Resets the database by rolling back all migrations.
 *
 * @param config - The migration configuration.
 * @param config.db - The Kysely database instance.
 * @param config.schema - The schema to use for the migrations. Should be the same as the schema used in the Kysely database instance.
 * @returns The migration results.
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
