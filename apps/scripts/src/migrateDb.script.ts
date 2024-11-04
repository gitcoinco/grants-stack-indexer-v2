import { configDotenv } from "dotenv";

import { createKyselyDatabase, migrateToLatest } from "@grants-stack-indexer/repository";

import { getDatabaseConfigFromEnv } from "./schemas/index.js";

configDotenv();

/**
 * This script handles database migrations for the grants-stack-indexer project.
 *
 * It performs the following steps:
 * 1. Loads environment variables from .env file
 * 2. Gets database configuration (URL and schema name) from environment
 * 3. Creates a Kysely database connection with the specified schema
 * 4. Runs any pending migrations from packages/repository/migrations
 * 5. Reports success/failure of migrations
 * 6. Closes database connection and exits
 *
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string
 * - DATABASE_SCHEMA: Schema name to migrate (e.g. "grants_stack")
 *
 * The script will:
 * - Create the schema if it doesn't exist
 * - Run all pending migrations in order
 * - Log results of each migration
 * - Exit with code 0 on success, 1 on failure
 */

export const main = async (): Promise<void> => {
    const { DATABASE_URL, DATABASE_SCHEMA } = getDatabaseConfigFromEnv();

    const db = createKyselyDatabase({
        connectionString: DATABASE_URL,
        withSchema: DATABASE_SCHEMA,
    });

    console.log(`Migrating database schema '${DATABASE_SCHEMA}'...`);

    const migrationResults = await migrateToLatest({
        db,
        schema: DATABASE_SCHEMA,
    });

    if (migrationResults && migrationResults?.length > 0) {
        const failedMigrations = migrationResults.filter(
            (migrationResult) => migrationResult.status === "Error",
        );

        if (failedMigrations.length > 0) {
            console.error("❌ Failed migrations:", failedMigrations);
            throw new Error("Failed migrations");
        }

        console.log(`✅ Migrations applied successfully`);
    } else {
        console.log("No migrations to apply");
    }

    await db.destroy();

    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
