import { configDotenv } from "dotenv";
import { pMapIterable } from "p-map";

import { getMetadataCidsFromEvents } from "@grants-stack-indexer/data-flow";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { CachingMetadataProvider, PublicGatewayProvider } from "@grants-stack-indexer/metadata";
import { createKyselyDatabase, KyselyMetadataCache } from "@grants-stack-indexer/repository";
import { ChainId, Logger } from "@grants-stack-indexer/shared";

import { getDatabaseConfigFromEnv } from "./schemas/index.js";
import { parseArguments } from "./utils/index.js";

configDotenv();

/**
 * This script manages metadata retrieval and caching for the grants-stack-indexer project.
 *
 * It performs the following steps:
 * 1. Loads environment variables from .env file
 * 2. Retrieves database configuration (URL and schema name) from environment
 * 3. Establishes a Kysely database connection with the specified schema
 * 4. Verifies database and table synchronization
 * 5. Initializes metadata repository and providers
 * 6. Fetches metadata CIDs from events and processes them
 *
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string
 * - NODE_ENV: Environment mode (production, staging, etc.)
 * - PUBLIC_GATEWAY_URLS: URLs for public gateway access
 * - INDEXER_URL: URL for the indexer service
 * - INDEXER_SECRET: Secret key for indexer authentication
 * - CHAIN_IDS: Supported blockchain chain IDs
 * - INDEXER_FETCH_LIMIT: Limit for fetching indexer data
 *
 * Script arguments:
 * - schema: Database schema name for operations
 *
 * The script will:
 * - Connect to the database and verify table existence
 * - Initialize metadata caching and retrieval services
 * - Fetch and process metadata CIDs from events
 * - Log the progress and results of operations
 *
 * Ensure proper configuration and backups before running this script.
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
    await db.selectFrom("metadataCache").selectAll().execute();

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
            cids.push(...getMetadataCidsFromEvents(flattedEvents, { ...console }));
            // Save checkpoint logic here (e.g., save cids or event data)
        }
        console.log("\n");
        console.log("Checkpoints by chainId:\r");
        console.log(checkpointMap);
    }

    console.log(cids.length, " where fetched");
    // Fetch metadata for each CID with concurrency limit
    let counter = 0;
    let nullCounter = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const metadata of pMapIterable(
        Array.from(cids),
        async (cid) => {
            try {
                const metadata = await publicGatewayProvider.getMetadata(cid);
                if (metadata === null) {
                    nullCounter++;
                } else {
                    counter++;
                }
                return { status: "fullfilled", value: metadata };
            } catch (error) {
                console.log(error);
                return { status: "rejected", error };
            }
        },
        {
            concurrency: 100,
        },
    )) {
        console.log(
            `${counter} / ${cids.length} CID's successfully fetched, errors: ${nullCounter}\r`,
        );
    }
    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
