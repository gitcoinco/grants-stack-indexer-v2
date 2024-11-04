import { promises as fs } from "fs";
import * as path from "path";
import { FileMigrationProvider, Kysely, MigrationResult, Migrator, NO_MIGRATIONS } from "kysely";

import { Database } from "./connection.js";

export interface MigrationConfig {
    db: Kysely<Database>;
    schema: string;
}

/**
 * Applies all migrations to the database up to the latest version.
 *
 * @param config - The migration configuration.
 * @param config.db - The Kysely database instance.
 * @param config.schema - The schema to use for the migrations. Should be the same as the schema used in the Kysely database instance.
 * @returns The migration results.
 */
export async function migrateToLatest(
    config: MigrationConfig,
): Promise<MigrationResult[] | undefined> {
    await config.db.schema.createSchema(config.schema).ifNotExists().execute();

    const migrator = new Migrator({
        db: config.db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(
                path.dirname(new URL(import.meta.url).pathname),
                "../migrations",
            ),
        }),
        migrationTableSchema: config.schema,
    });

    const { error, results } = await migrator.migrateToLatest();

    results?.forEach((it) => {
        if (it.status === "Success") {
            console.log(`migration "${it.migrationName}" was executed successfully`);
        } else if (it.status === "Error") {
            console.error(`failed to execute migration "${it.migrationName}"`);
        }
    });

    if (error) {
        console.error("failed to migrate");
        console.error(error);
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
export async function resetDatabase(
    config: MigrationConfig,
): Promise<MigrationResult[] | undefined> {
    const migrator = new Migrator({
        db: config.db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(
                path.dirname(new URL(import.meta.url).pathname),
                "../migrations",
            ),
        }),
    });

    const { error, results } = await migrator.migrateTo(NO_MIGRATIONS);

    if (error) {
        console.error("failed to reset database");
        console.error(error);
        throw error;
    }

    return results;
}
