import { configDotenv } from "dotenv";

import { createKyselyDatabase, resetDatabase } from "@grants-stack-indexer/repository";

import { getDatabaseConfigFromEnv } from "./schemas/index.js";

configDotenv();

/**
 * This script handles database reset for the grants-stack-indexer project.
 *
 * It performs the following steps:
 * 1. Loads environment variables from .env file
 * 2. Gets database configuration (URL and schema name) from environment
 * 3. Creates a Kysely database connection with the specified schema
 * 4. Drops and recreates the database schema
 * 5. Reports success/failure of reset operation
 * 6. Closes database connection and exits
 *
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string
 * - DATABASE_SCHEMA: Schema name to reset (e.g. "grants_stack")
 *
 * The script will:
 * - Drop the schema if it exists
 * - Recreate an empty schema
 * - Log results of the reset operation
 * - Exit with code 0 on success, 1 on failure
 *
 * WARNING: This is a destructive operation that will delete all data in the schema.
 * Make sure you have backups if needed before running this script.
 */

const main = async (): Promise<void> => {
    const { DATABASE_URL, DATABASE_SCHEMA } = getDatabaseConfigFromEnv();

    const db = createKyselyDatabase({
        connectionString: DATABASE_URL,
        withSchema: DATABASE_SCHEMA,
    });

    console.log(`Resetting database schema '${DATABASE_SCHEMA}'...`);

    const resetResults = await resetDatabase({
        db,
        schema: DATABASE_SCHEMA,
    });

    if (resetResults && resetResults?.length > 0) {
        const failedResets = resetResults.filter((resetResult) => resetResult.status === "Error");

        if (failedResets.length > 0) {
            console.error("❌ Failed resets:", failedResets);
            throw new Error("Failed resets");
        }

        console.log(`✅ Reset applied successfully`);
    } else {
        console.log("No resets to apply");
    }

    await db.destroy();

    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
