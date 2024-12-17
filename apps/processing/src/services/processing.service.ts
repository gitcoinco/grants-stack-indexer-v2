import { optimism } from "viem/chains";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import {
    DatabaseEventRegistry,
    DatabaseStrategyRegistry,
    InMemoryCachedEventRegistry,
    InMemoryCachedStrategyRegistry,
    Orchestrator,
} from "@grants-stack-indexer/data-flow";
import { ChainId, Logger } from "@grants-stack-indexer/shared";

import { Environment } from "../config/env.js";
import { SharedDependencies, SharedDependenciesService } from "./index.js";

/**
 * Processor service application
 * - Initializes core dependencies (repositories, providers) via SharedDependenciesService
 * - Initializes a StrategyRegistry and loads it with strategies from the database
 * For each chain:
 * - Sets up EVM provider with configured RPC endpoints
 * - Instantiates an EventsRegistry and loads it with the last processed event for the chain
 * - Creates an Orchestrator instance to coordinate an specific chain:
 *   - Fetching on-chain events via indexer client
 *   - Processing events through registered handlers
 *   - Storing processed data in PostgreSQL via repositories
 * - Manages graceful shutdown on termination signals
 */
export class ProcessingService {
    private readonly orchestrators: Map<ChainId, Orchestrator> = new Map();
    private readonly logger = new Logger({ className: "ProcessingService" });
    private readonly kyselyDatabase: SharedDependencies["kyselyDatabase"];

    private constructor(
        orchestrators: Map<ChainId, Orchestrator>,
        kyselyDatabase: SharedDependencies["kyselyDatabase"],
    ) {
        this.orchestrators = orchestrators;
        this.kyselyDatabase = kyselyDatabase;
    }

    static async initialize(env: Environment): Promise<ProcessingService> {
        const sharedDependencies = await SharedDependenciesService.initialize(env);
        const { CHAINS: chains } = env;
        const { core, registriesRepositories, indexerClient, kyselyDatabase } = sharedDependencies;
        const { eventRegistryRepository, strategyRegistryRepository } = registriesRepositories;
        const orchestrators: Map<ChainId, Orchestrator> = new Map();

        const strategyRegistry = await InMemoryCachedStrategyRegistry.initialize(
            new Logger({ className: "InMemoryCachedStrategyRegistry" }),
            new DatabaseStrategyRegistry(
                new Logger({ className: "DatabaseStrategyRegistry" }),
                strategyRegistryRepository,
            ),
        );
        const eventsRegistry = new DatabaseEventRegistry(
            new Logger({ className: "DatabaseEventRegistry" }),
            eventRegistryRepository,
        );

        for (const chain of chains) {
            const chainLogger = new Logger({ chainId: chain.id as ChainId });
            // Initialize EVM provider
            const evmProvider = new EvmProvider(chain.rpcUrls, optimism, chainLogger);

            // Initialize events registry for the chain
            const cachedEventsRegistry = await InMemoryCachedEventRegistry.initialize(
                new Logger({ className: "InMemoryCachedEventRegistry" }),
                eventsRegistry,
                [chain.id as ChainId],
            );

            orchestrators.set(
                chain.id as ChainId,
                new Orchestrator(
                    chain.id as ChainId,
                    { ...core, evmProvider },
                    indexerClient,
                    {
                        eventsRegistry: cachedEventsRegistry,
                        strategyRegistry,
                    },
                    chain.fetchLimit,
                    chain.fetchDelayMs,
                    chainLogger,
                ),
            );
        }

        return new ProcessingService(orchestrators, kyselyDatabase);
    }

    /**
     * Start the processor service
     *
     * The processor runs indefinitely until it is terminated.
     */
    async start(): Promise<void> {
        this.logger.info("Starting processor service...");

        const abortController = new AbortController();

        const orchestratorProcesses: Promise<void>[] = [];

        // Handle graceful shutdown
        process.on("SIGINT", () => {
            this.logger.info("Received SIGINT signal. Shutting down...");
            abortController.abort();
        });

        process.on("SIGTERM", () => {
            this.logger.info("Received SIGTERM signal. Shutting down...");
            abortController.abort();
        });

        try {
            for (const orchestrator of this.orchestrators.values()) {
                this.logger.info(`Starting orchestrator for chain ${orchestrator.chainId}...`);
                orchestratorProcesses.push(orchestrator.run(abortController.signal));
            }

            await Promise.allSettled(orchestratorProcesses);
        } catch (error) {
            this.logger.error(`Processor service failed: ${error}`);
            throw error;
        }
    }

    /**
     * Call this function when the processor service is terminated
     * - Releases database resources
     */
    async releaseResources(): Promise<void> {
        try {
            this.logger.info("Releasing resources...");
            await this.kyselyDatabase.destroy();
        } catch (error) {
            this.logger.error(`Error releasing resources: ${error}`);
        }
    }
}
