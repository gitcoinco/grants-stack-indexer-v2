import { pMapIterable } from "p-map";
import { retry, RetryOptions } from "ts-retry";

import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import {
    CachingPricingProvider,
    PricingProviderFactory,
    UnsupportedToken,
} from "@grants-stack-indexer/pricing";
import { createKyselyDatabase, KyselyPricingCache } from "@grants-stack-indexer/repository";
import {
    ChainId,
    Logger,
    TimestampMs,
    TokenCode,
    TOKENS_SOURCE_CODES,
} from "@grants-stack-indexer/shared";

import { getDatabaseConfigFromEnv, getEnv } from "./schemas/index.js";
import { parseArguments } from "./utils/index.js";

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
    const { DATABASE_URL, NODE_ENV, INDEXER_URL, INDEXER_SECRET, CHAIN_IDS } =
        getDatabaseConfigFromEnv();
    const env = getEnv();
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

    // This is only to try in advance if we have the tables and db in sync
    await db
        .insertInto("priceCache")
        .values({
            createdAt: new Date(),
            priceUsd: 100,
            timestampMs: 100,
            tokenCode: "ETH" as TokenCode,
        })
        .execute();

    const pricingRepository = new KyselyPricingCache(db, schema);

    const pricingProvider = PricingProviderFactory.create(env, { logger });
    const cachedPricingProvider = new CachingPricingProvider(
        pricingProvider,
        pricingRepository,
        logger,
    );

    const envioIndexerClient = new EnvioIndexerClient(INDEXER_URL, INDEXER_SECRET);

    const blockRanges: Record<ChainId, { from: number; to: number }> = {};
    for (const chainId of CHAIN_IDS) {
        blockRanges[chainId as ChainId] = await envioIndexerClient.getBlockRangeTimestampByChainId(
            chainId as ChainId,
        );
    }
    const minFrom = Math.min(...Object.values(blockRanges).map((range) => range.from));
    const maxTo = Math.max(...Object.values(blockRanges).map((range) => range.to));

    console.log("blockRanges", blockRanges);
    console.log(`Minimum 'from' value: ${minFrom}`);
    console.log(`Maximum 'to' value: ${maxTo}`);

    const retryOptions: RetryOptions = {
        maxTry: 10,
        delay: 1000,
    };
    for await (const tokenCode of pMapIterable(
        TOKENS_SOURCE_CODES,
        async (tokenCode) => {
            try {
                await retry(
                    () =>
                        cachedPricingProvider.getTokenPrices(tokenCode as TokenCode, [
                            ((minFrom as number) * 1000) as TimestampMs,
                            ((maxTo as number) * 1000) as TimestampMs,
                        ]),
                    retryOptions,
                );
                return { status: "fullfilled", value: tokenCode };
            } catch (error) {
                if (error instanceof UnsupportedToken) {
                    console.log(`${tokenCode} is not supported `);
                }
                return { status: "rejected", error };
            }
        },
        { concurrency: 10 },
    )) {
        console.log(`${JSON.stringify(tokenCode, undefined, 4)} fetched `);
    }

    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
