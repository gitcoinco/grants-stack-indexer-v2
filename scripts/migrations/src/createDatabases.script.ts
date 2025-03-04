import { configDotenv } from "dotenv";
import pg from "pg";

import { Logger, stringify } from "@grants-stack-indexer/shared";

import { BLUE_DB, ConnectionDetails, extractConnectionDetails, GREEN_DB } from "./constants.js";
import { getDatabaseConfigFromEnv } from "./schemas/index.js";

const { Pool } = pg;

configDotenv();

/**
 * This script creates the blue and green databases for blue-green deployment strategy.
 *
 * It performs the following steps:
 * 1. Loads environment variables from .env file
 * 2. Gets database configuration from environment
 * 3. Creates both blue and green databases if they don't already exist
 *
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string (used to extract host, port, user, password)
 */

/**
 * Create a database if it doesn't exist
 */
export const createDatabaseIfNotExists = async (
    dbName: string,
    connectionDetails: ConnectionDetails,
): Promise<void> => {
    const logger = Logger.getInstance();
    const { host, port, user, password } = connectionDetails;

    // Configure pool with RDS-appropriate settings to connect to postgres db
    const pool = new Pool({
        host,
        port: parseInt(port, 10),
        user,
        password,
        ssl:
            process.env.NODE_ENV === "production"
                ? {
                      rejectUnauthorized: false,
                  }
                : undefined,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 10000,
        max: 5,
    });

    try {
        // First check if database already exists
        const checkResult = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [
            dbName,
        ]);

        if (checkResult.rowCount && checkResult.rowCount > 0) {
            logger.info(`Database '${dbName}' already exists.`);
            return;
        }

        // Execute CREATE DATABASE
        logger.info(`Creating new database '${dbName}'...`);
        await pool.query(`CREATE DATABASE "${dbName}" OWNER "${user}"`);

        logger.info(`Database '${dbName}' created successfully.`);
    } catch (error) {
        logger.error(`Failed to create database: ${stringify(error)}`);
        throw error;
    } finally {
        // Always close the pool
        await pool.end();
    }
};

export const main = async (): Promise<void> => {
    const { DATABASE_URL } = getDatabaseConfigFromEnv();
    const connectionDetails = extractConnectionDetails(DATABASE_URL);

    const logger = Logger.getInstance();
    logger.info("Creating blue and green databases if they don't exist...");

    // Create both databases if they don't exist
    await createDatabaseIfNotExists(BLUE_DB, connectionDetails);
    await createDatabaseIfNotExists(GREEN_DB, connectionDetails);

    logger.info("✅ Database setup completed successfully");

    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
