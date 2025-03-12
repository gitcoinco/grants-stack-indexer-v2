import { configDotenv } from "dotenv";
import { pMapIterable } from "p-map";
import { retry, RetryOptions } from "ts-retry";
import { Address, Chain, extractChain, InvalidChainIdError } from "viem";
import * as viemChains from "viem/chains";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { iStrategyAbi } from "@grants-stack-indexer/data-flow/dist/src/internal.js";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { existsHandler } from "@grants-stack-indexer/processors";
import {
    createKyselyDatabase,
    KyselyStrategyRegistryRepository,
    KyselyStrategyTimingsCache,
} from "@grants-stack-indexer/repository";
import { ChainId, Logger, ProcessorEvent } from "@grants-stack-indexer/shared";

import {
    ProcessorDependencies,
    StrategyHandlerFactory,
} from "../../../packages/processors/dist/src/internal.js";
import { getDatabaseConfigFromEnv } from "./schemas/index.js";
import { parseArguments } from "./utils/index.js";

configDotenv();

/**
 * This script manages strategy timings retrieval and caching for the grants-stack-indexer project.
 *
 * It performs the following steps:
 * 1. Loads environment variables from .env file
 * 2. Retrieves database configuration (URL and schema name) from environment
 * 3. Establishes a Kysely database connection with the specified schema
 * 4. Verifies database and table synchronization
 * 5. Initializes strategy repositories and providers
 * 6. Fetches PoolCreated events from the indexer
 * 7. Retrieves strategy IDs for each strategy address
 * 8. Fetches and caches strategy timings for each strategy
 *
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string
 * - NODE_ENV: Environment mode (production, staging, etc.)
 * - INDEXER_URL: URL for the indexer service
 * - INDEXER_SECRET: Secret key for indexer authentication
 * - CHAIN_IDS: Supported blockchain chain IDs
 * - CHAINS: Chain configurations including RPC URLs
 * - INDEXER_FETCH_LIMIT: Limit for fetching indexer data
 *
 * Script arguments:
 * - schema: Database schema name for operations
 *
 * Ensure proper configuration and backups before running this script.
 */

const main = async (): Promise<void> => {
    const {
        DATABASE_URL,
        NODE_ENV,
        INDEXER_URL,
        INDEXER_SECRET,
        CHAIN_IDS,
        INDEXER_FETCH_LIMIT,
        CHAINS,
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
    await db.selectFrom("strategyTimings").select("address").limit(1).execute();
    await db.selectFrom("strategiesRegistry").select("id").limit(1).execute();

    const strategyTimingsRepository = new KyselyStrategyTimingsCache(db, schema);
    const strategyRegistry = new KyselyStrategyRegistryRepository(db, schema);
    const envioIndexerClient = new EnvioIndexerClient(INDEXER_URL, INDEXER_SECRET);
    const poolCreatedEvents: ProcessorEvent<"Allo", "PoolCreated">[] = [];
    let hasMoreEvents = true; // Flag to control the loop

    const checkpointMap = new Map<
        number,
        {
            blockNumber: number;
            logIndex: number;
        }
    >();

    /**
     * Fetch PoolCreated events from the indexer
     */
    while (hasMoreEvents) {
        //Fetch events
        const events = await Promise.all(
            CHAIN_IDS.map(async (chainId) => {
                return envioIndexerClient.getEvents({
                    chainId: chainId as ChainId,
                    from: checkpointMap.get(chainId),
                    limit: INDEXER_FETCH_LIMIT,
                    eventName: "PoolCreated",
                });
            }),
        );
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
            poolCreatedEvents.push(...(flattedEvents as ProcessorEvent<"Allo", "PoolCreated">[]));
        }
        console.log(flattedEvents, " events fetched");
        console.log("\n");
        console.log("Checkpoints by chainId:\r");
        console.log(checkpointMap);
    }

    console.log(poolCreatedEvents.length, " pool created events fetched");

    let nullCounter = 0;
    const evmProviders = new Map<ChainId, EvmProvider>();

    const viemChainsArray = Object.values(viemChains) as Chain[];

    for (const chain of CHAINS) {
        const viemChain = extractChain({
            chains: viemChainsArray,
            id: chain.id,
        });
        if (!viemChain) {
            throw new InvalidChainIdError({ chainId: chain.id });
        }
        evmProviders.set(chain.id as ChainId, new EvmProvider(chain.rpcUrls, viemChain, logger));
    }

    const strategyAddresses: [ChainId, Address][] = [];

    for (const poolCreatedEvent of poolCreatedEvents) {
        strategyAddresses.push([
            poolCreatedEvent.chainId as ChainId,
            poolCreatedEvent.params.strategy,
        ]);
    }

    console.log("There are ", strategyAddresses.length, " strategy addresses");
    const retryOptions: RetryOptions = {
        maxTry: 10,
        delay: 1000,
    };
    let strategyIdCounter = 0;
    const strategyAddressId: [ChainId, Address, string][] = [];

    /**
     * Populate strategyRegistry with strategyIds
     */
    for await (const _strategy of pMapIterable(
        strategyAddresses,
        async (strategy) => {
            try {
                await retry(async () => {
                    //check if exists on strategyRegistry
                    const strategyOnRegistry =
                        await strategyRegistry.getStrategyByChainIdAndAddress(
                            strategy[0] as ChainId,
                            strategy[1] as Address,
                        );
                    if (strategyOnRegistry) {
                        strategyIdCounter++;
                        strategyAddressId.push([
                            strategy[0] as ChainId,
                            strategy[1] as Address,
                            strategyOnRegistry.id,
                        ]);
                        return;
                    }
                    if (strategy[0] && evmProviders.get(strategy[0] as ChainId)) {
                        const strategyId = (await evmProviders
                            .get(strategy[0] as ChainId)
                            ?.readContract(
                                strategy[1] as Address,
                                iStrategyAbi,
                                "getStrategyId",
                            )) as string;
                        strategyAddressId.push([
                            strategy[0] as ChainId,
                            strategy[1] as Address,
                            strategyId,
                        ]);
                        await strategyRegistry.saveStrategy({
                            address: strategy[1] as Address,
                            chainId: strategy[0] as ChainId,
                            id: strategyId as `0x${string}`,
                            handled: existsHandler(strategyId as `0x${string}`),
                        });
                        strategyIdCounter++;
                    }
                }, retryOptions);
            } catch (error) {
                nullCounter++;
                console.log(error);
            }
        },
        {
            concurrency: 10,
        },
    )) {
        console.log(
            " StrategyId counter: ",
            strategyIdCounter,
            " out of ",
            strategyAddresses.length,
            " errors: ",
            nullCounter,
        );
    }
    let strategyTimingsCounter = 0;
    let nullStrategyTimingsCounter = 0;

    /**
     * Cache strategy timings
     */
    for await (const _s of pMapIterable(strategyAddressId, async (strategyAddressId) => {
        try {
            //check if exists on strategyTimings
            const strategyTimingsOnRegistry = await strategyTimingsRepository.get(
                strategyAddressId[1] as Address,
            );
            if (strategyTimingsOnRegistry) {
                strategyTimingsCounter++;
                return;
            }
            const strategyHandler = StrategyHandlerFactory.createHandler(
                strategyAddressId[0] as ChainId,
                {
                    logger,
                    evmProvider: evmProviders.get(strategyAddressId[0] as ChainId) as EvmProvider,
                } as unknown as ProcessorDependencies,
                strategyAddressId[2] as `0x${string}`,
            );
            const strategyTimings = await strategyHandler?.fetchStrategyTimings(
                strategyAddressId[1] as Address,
            );
            await strategyTimingsRepository.set(strategyAddressId[1] as Address, {
                address: strategyAddressId[1] as Address,
                strategyId: strategyAddressId[2] as `0x${string}`,
                timings: strategyTimings,
                createdAt: new Date(),
            });
            if (!strategyTimings) {
                strategyTimingsCounter++;
                return {
                    applicationsStartTime: null,
                    applicationsEndTime: null,
                    donationsStartTime: null,
                    donationsEndTime: null,
                };
            }
            strategyTimingsCounter++;
        } catch (error) {
            nullStrategyTimingsCounter++;
            console.log(error);
        }
    })) {
        console.log(
            " StrategyTimings counter: ",
            strategyTimingsCounter,
            " out of ",
            strategyAddressId.length,
            " errors: ",
            nullStrategyTimingsCounter,
        );
    }
    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
