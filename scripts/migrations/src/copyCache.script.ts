import { configDotenv } from "dotenv";
import pg from "pg";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { Logger, stringify } from "@grants-stack-indexer/shared";

import { BLUE_DB, ConnectionDetails, extractConnectionDetails, GREEN_DB } from "./constants.js";
import { getDatabaseConfigFromEnv } from "./schemas/index.js";

configDotenv();

const { Pool } = pg;

/**
 * This script copies all table data between blue and green databases.
 *
 * It performs the following steps:
 * 1. Loads environment variables from .env file
 * 2. Gets database configuration from environment
 * 3. Copies all tables from source to target database, resetting destination tables first
 *
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string (used to extract host, port, user, password)
 *
 * Script arguments:
 * - copyFrom: Source database color ('blue' or 'green')
 */

// Define interfaces for our command arguments
interface CopyCacheCommandArgs {
    _: (string | number)[];
    copyFrom: "blue" | "green";
    f?: "blue" | "green";
    $0: string;
    [key: string]: unknown;
}

// Define interfaces for database query results
interface TableNameRow {
    table_name: string;
}

interface ColumnNameRow {
    column_name: string;
}

interface DatabaseRow {
    [column: string]: unknown;
}

const parseArguments = (): CopyCacheCommandArgs => {
    return yargs(hideBin(process.argv))
        .option("copyFrom", {
            alias: "f",
            type: "string",
            choices: ["blue", "green"],
            demandOption: true,
            description: 'Source database color to copy from ("blue" or "green")',
        })
        .strict()
        .parseSync() as CopyCacheCommandArgs;
};

/**
 * Get all tables in the public schema
 */
export const getAllTables = async (
    db: string,
    connectionDetails: ConnectionDetails,
): Promise<string[]> => {
    const logger = Logger.getInstance();
    const { host, port, user, password } = connectionDetails;

    const pool = new Pool({
        host,
        port: parseInt(port, 10),
        user,
        password,
        database: db,
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
        logger.info(`Getting all tables from database '${db}'...`);

        const result = await pool.query<TableNameRow>(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const tables = result.rows.map((row) => row.table_name);
        logger.info(`Found ${tables.length} tables in database '${db}'`);
        return tables;
    } catch (error) {
        logger.error(`Failed to get tables: ${stringify(error)}`);
        throw error;
    } finally {
        await pool.end();
    }
};

/**
 * Copy table data between databases
 */
export const copyTableData = async (
    sourceDb: string,
    targetDb: string,
    tableName: string,
    connectionDetails: ConnectionDetails,
): Promise<void> => {
    const logger = Logger.getInstance();
    const { host, port, user, password } = connectionDetails;

    // Connect to the target database
    const targetPool = new Pool({
        host,
        port: parseInt(port, 10),
        user,
        password,
        database: targetDb,
        ssl:
            process.env.NODE_ENV === "production"
                ? {
                      rejectUnauthorized: false,
                  }
                : undefined,
        connectionTimeoutMillis: 30000, // Longer timeout for data copy
        idleTimeoutMillis: 10000,
        max: 5,
    });

    // Create a connection to the source database
    const sourcePool = new Pool({
        host,
        port: parseInt(port, 10),
        user,
        password,
        database: sourceDb,
        ssl:
            process.env.NODE_ENV === "production"
                ? {
                      rejectUnauthorized: false,
                  }
                : undefined,
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 10000,
        max: 5,
    });

    try {
        logger.info(`Copying data for table '${tableName}' from ${sourceDb} to ${targetDb}...`);

        // First truncate the target table
        await targetPool.query(`TRUNCATE TABLE "${tableName}" CASCADE`);

        // Get the column names from the source table
        const columnResult = await sourcePool.query<ColumnNameRow>(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            ORDER BY ordinal_position
        `,
            [tableName],
        );

        const columns = columnResult.rows.map((row) => row.column_name);

        if (columns.length === 0) {
            logger.warn(`No columns found for table '${tableName}'. Skipping.`);
            return;
        }

        // Get data from source
        const dataResult = await sourcePool.query<DatabaseRow>(`SELECT * FROM "${tableName}"`);

        if (dataResult.rows.length === 0) {
            logger.info(`No data in source table '${tableName}'. Skipping insert.`);
            return;
        }

        // Insert data into target in batches
        const batchSize = 1000;
        const totalRows = dataResult.rows.length;
        let processedRows = 0;

        logger.info(`Copying ${totalRows} rows for table '${tableName}'...`);

        // PostgreSQL has a limit on parameters, so we process in batches
        for (let i = 0; i < totalRows; i += batchSize) {
            const batch = dataResult.rows.slice(i, i + batchSize);

            // Create a parameterized query for this batch
            const valueStrings = [];
            const valueParams = [];
            let paramIndex = 1;

            for (const row of batch) {
                const rowParams = [];
                for (const col of columns) {
                    rowParams.push(`$${paramIndex++}`);
                    valueParams.push(row[col]);
                }
                valueStrings.push(`(${rowParams.join(", ")})`);
            }

            const insertQuery = `
                INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")})
                VALUES ${valueStrings.join(", ")}
            `;

            await targetPool.query(insertQuery, valueParams);

            processedRows += batch.length;
            logger.info(`Processed ${processedRows} of ${totalRows} rows for table '${tableName}'`);
        }

        logger.info(`Completed copying data for table '${tableName}'`);
    } catch (error) {
        logger.error(`Failed to copy table data: ${stringify(error)}`);
        throw error;
    } finally {
        await targetPool.end();
        await sourcePool.end();
    }
};

/**
 * Copy all tables data from one database to another
 */
export const copyAllTableData = async (
    sourceDb: string,
    targetDb: string,
    connectionDetails: ConnectionDetails,
): Promise<void> => {
    const logger = Logger.getInstance();

    try {
        logger.info(`Copying all table data from '${sourceDb}' to '${targetDb}'...`);

        // Get all tables from source database
        const tables = await getAllTables(sourceDb, connectionDetails);

        if (tables.length === 0) {
            logger.warn("No tables found in source database. Nothing to copy.");
            return;
        }

        logger.info(`Found ${tables.length} tables to copy from source database`);

        // Copy each table
        for (const table of tables) {
            await copyTableData(sourceDb, targetDb, table, connectionDetails);
        }

        logger.info(`✅ Successfully copied all table data from '${sourceDb}' to '${targetDb}'`);
    } catch (error) {
        logger.error(`Failed to copy table data: ${stringify(error)}`);
        throw error;
    }
};

export const main = async (): Promise<void> => {
    const { DATABASE_URL } = getDatabaseConfigFromEnv();
    const args = parseArguments();
    const connectionDetails = extractConnectionDetails(DATABASE_URL);

    const logger = Logger.getInstance();

    const sourceColor = args.copyFrom;
    const targetColor = sourceColor === "blue" ? "green" : "blue";

    const sourceDb = sourceColor === "blue" ? BLUE_DB : GREEN_DB;
    const targetDb = sourceColor === "blue" ? GREEN_DB : BLUE_DB;

    logger.info(`Copying all table data from ${sourceColor} to ${targetColor}...`);
    await copyAllTableData(sourceDb, targetDb, connectionDetails);

    logger.info(`✅ Database ${targetColor} is now an exact copy of ${sourceColor}`);

    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
