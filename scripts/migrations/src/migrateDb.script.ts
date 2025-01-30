import { configDotenv } from "dotenv";

import { createKyselyDatabase } from "@grants-stack-indexer/repository";
import { Logger, stringify } from "@grants-stack-indexer/shared";

import { getDatabaseConfigFromEnv } from "./schemas/index.js";
import { getMigrationsFolder, migrateToLatest, parseArguments } from "./utils/index.js";

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
 *
 * Script arguments:
 * - schema: Database schema name where migrations are applied
 *
 * The script will:
 * - Create the schema if it doesn't exist
 * - Run all pending migrations in order
 * - Log results of each migration
 * - Exit with code 0 on success, 1 on failure
 */

export const main = async (): Promise<void> => {
    const { DATABASE_URL, NODE_ENV } = getDatabaseConfigFromEnv();
    const { schema } = parseArguments();

    const logger = Logger.getInstance();

    const db = createKyselyDatabase(
        {
            connectionString: DATABASE_URL,
            withSchema: schema,
            isProduction: NODE_ENV === "production" || NODE_ENV === "staging",
        },
        logger,
    );

    logger.info(`Migrating database schema '${schema}'...`);

    const migrationResults = await migrateToLatest(
        {
            db,
            schema,
            migrationsFolder: getMigrationsFolder(),
        },
        logger,
    );

    if (migrationResults && migrationResults?.length > 0) {
        const failedMigrations = migrationResults.filter(
            (migrationResult) => migrationResult.status === "Error",
        );

        if (failedMigrations.length > 0) {
            logger.error(`❌ Failed migrations: ${stringify(failedMigrations)}`);
            throw new Error("Failed migrations");
        }

        logger.info(`✅ Migrations applied successfully`);
    } else {
        logger.info("No migrations to apply");
    }

    await db.destroy();

    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
