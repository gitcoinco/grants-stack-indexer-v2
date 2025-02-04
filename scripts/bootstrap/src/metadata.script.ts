import fs from "fs";
import { configDotenv } from "dotenv";
import { pMapIterable } from "p-map";
import { retry, RetryOptions } from "ts-retry";

import { getMetadataCidsFromEvents } from "@grants-stack-indexer/data-flow";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { CachingMetadataProvider, PublicGatewayProvider } from "@grants-stack-indexer/metadata";
import { createKyselyDatabase, KyselyMetadataCache } from "@grants-stack-indexer/repository";
import { ChainId, Logger } from "@grants-stack-indexer/shared";

import { getDatabaseConfigFromEnv } from "./schemas/index.js";
import { parseArguments } from "./utils/index.js";

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
 *
 * Script arguments:
 * - schema: Database schema name where migrations are applied
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
    const {
        DATABASE_URL,
        NODE_ENV,
        PUBLIC_GATEWAY_URLS,
        INDEXER_URL,
        INDEXER_SECRET,
        CHAIN_IDS,
        INDEXER_FETCH_LIMIT,
    } = getDatabaseConfigFromEnv();
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

    //This is only to try in advance if we have the tables and db in sync
    await db
        .insertInto("metadataCache")
        .values({ id: "asd", metadata: { asd: "asd" }, createdAt: new Date() })
        .execute();

    const metadataRepository = new KyselyMetadataCache(db, schema);

    const publicGatewayProvider = new CachingMetadataProvider(
        new PublicGatewayProvider(PUBLIC_GATEWAY_URLS, logger),
        metadataRepository,
        logger,
    );

    const envioIndexerClient = new EnvioIndexerClient(INDEXER_URL, INDEXER_SECRET);
    const cids: string[] = [];
    let hasMoreEvents = true; // Flag to control the loop

    const checkpointMap = new Map<
        number,
        {
            blockNumber: number;
            logIndex: number;
        }
    >();
    if (fs.existsSync("cids.txt")) {
        cids.push(...fs.readFileSync("cids.txt", "utf-8").split("\n"));
    } else {
        while (hasMoreEvents) {
            const events = await Promise.all(
                CHAIN_IDS.map(async (chainId) => {
                    return envioIndexerClient.getEvents({
                        chainId: chainId as ChainId,
                        from: checkpointMap.get(chainId),
                        limit: INDEXER_FETCH_LIMIT,
                    });
                }),
            );

            // Save checkpoint logic here (e.g., save cids or event data)
            events.forEach((events) => {
                checkpointMap.set(events[0]?.chainId ?? 0, {
                    blockNumber: events[events.length - 1]?.blockNumber ?? 0,
                    logIndex: events[events.length - 1]?.logIndex ?? 0,
                });
            });
            const flattedEvents = events.flat();
            if (flattedEvents.length === 0) {
                hasMoreEvents = false; // No more flattedEvents to process
            } else {
                cids.push(...getMetadataCidsFromEvents(flattedEvents));
                // Save checkpoint logic here (e.g., save cids or event data)
            }
            fs.writeFileSync("cids.txt", cids.join("\n"));
            console.log("\n");
            console.log("Checkpoints by chainId:\r");
            console.log(checkpointMap);
        }
    }

    const retryOptions: RetryOptions = {
        maxTry: 10,
        delay: 1000,
    };
    console.log(cids.length, " where fetched");
    // Fetch metadata for each CID with concurrency limit
    let counter = 0;
    let errorCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const metadata of pMapIterable(
        Array.from(cids),
        async (cid) => {
            try {
                const metadata = await retry(
                    () => publicGatewayProvider.getMetadata(cid),
                    retryOptions,
                );
                return { status: "fullfilled", value: metadata };
            } catch (error) {
                return { status: "rejected", error };
            }
        },
        {
            concurrency: 1000,
        },
    )) {
        if (metadata.status === "fullfilled") {
            counter++;
        }
        if (metadata.status === "rejected") {
            errorCount++;
        }
        process.stdout.write(
            `${counter} / ${cids.length} CID's successfully fetched, errors: ${errorCount}\r`,
        );
    }
    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
