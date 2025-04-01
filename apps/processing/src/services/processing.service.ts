import { Chain, extractChain } from "viem";
import * as viemChains from "viem/chains";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import {
    DatabaseEventRegistry,
    DatabaseStrategyRegistry,
    InMemoryCachedStrategyRegistry,
    Orchestrator,
    RetroactiveProcessor,
} from "@grants-stack-indexer/data-flow";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { Environment } from "../config/env.js";
import { InvalidChainId } from "../exceptions/index.js";
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
    private readonly orchestrators: Map<ChainId, [Orchestrator, RetroactiveProcessor]> = new Map();
    private readonly logger: ILogger;
    private readonly kyselyDatabase: SharedDependencies["kyselyDatabase"];

    private constructor(
        orchestrators: Map<ChainId, [Orchestrator, RetroactiveProcessor]>,
        kyselyDatabase: SharedDependencies["kyselyDatabase"],
        logger: ILogger,
    ) {
        this.orchestrators = orchestrators;
        this.kyselyDatabase = kyselyDatabase;
        this.logger = logger;
    }

    static async initialize(env: Environment): Promise<ProcessingService> {
        const sharedDependencies = await SharedDependenciesService.initialize(env);
        const { logger } = sharedDependencies;
        logger.debug("Shared dependencies initialized");

        const { CHAINS: chains } = env;
        const {
            core,
            registriesRepositories,
            indexerClient,
            kyselyDatabase,
            retryStrategy,
            notifier,
        } = sharedDependencies;
        const {
            eventRegistryRepository,
            strategyRegistryRepository,
            strategyProcessingCheckpointRepository,
        } = registriesRepositories;

        const orchestrators: Map<ChainId, [Orchestrator, RetroactiveProcessor]> = new Map();
        logger.debug("Starting chain initialization", { chainCount: chains.length });

        const strategyRegistry = new DatabaseStrategyRegistry(logger, strategyRegistryRepository);
        const eventsRegistry = new DatabaseEventRegistry(logger, eventRegistryRepository);
        logger.debug("Created base registries");

        const viemChainsArray = Object.values(viemChains) as Chain[];

        for (const chain of chains) {
            logger.debug("Processing chain configuration", { chainId: chain.id });

            const viemChain = extractChain({
                chains: viemChainsArray,
                id: chain.id,
            });
            if (!viemChain) {
                logger.error("Invalid chain configuration", { chainId: chain.id });
                throw new InvalidChainId(chain.id);
            }

            const evmProvider = new EvmProvider(chain.rpcUrls, viemChain, logger);
            logger.debug("EVM provider created", { chainId: chain.id });

            const cachedStrategyRegistry = await InMemoryCachedStrategyRegistry.initialize(
                logger,
                strategyRegistry,
                chain.id as ChainId,
            );
            logger.debug("Cached strategy registry initialized", { chainId: chain.id });

            const orchestrator = new Orchestrator(
                chain.id as ChainId,
                { ...core, evmProvider },
                indexerClient,
                {
                    eventsRegistry,
                    strategyRegistry: cachedStrategyRegistry,
                },
                chain.fetchLimit,
                chain.fetchDelayMs,
                retryStrategy,
                logger,
                notifier,
            );
            logger.debug("Orchestrator created", { chainId: chain.id });

            const retroactiveProcessor = new RetroactiveProcessor(
                chain.id as ChainId,
                { ...core, evmProvider },
                indexerClient,
                {
                    eventsRegistry,
                    strategyRegistry: cachedStrategyRegistry,
                    checkpointRepository: strategyProcessingCheckpointRepository,
                },
                chain.fetchLimit,
                retryStrategy,
                logger,
            );
            logger.debug("Retroactive processor created", { chainId: chain.id });

            orchestrators.set(chain.id as ChainId, [orchestrator, retroactiveProcessor]);
            logger.debug("Chain setup completed", { chainId: chain.id });
        }

        logger.debug("All chains initialized", { chainCount: orchestrators.size });
        return new ProcessingService(orchestrators, kyselyDatabase, logger);
    }

    /**
     * Start the processor service
     *
     * The processor runs indefinitely until it is terminated.
     */
    async start(): Promise<void> {
        this.logger.info("Starting processor service...");

        const abortController = new AbortController();
        this.logger.debug("Created abort controller");

        const orchestratorProcesses: Promise<void>[] = [];

        process.on("SIGINT", () => {
            this.logger.info("Received SIGINT signal. Shutting down...");
            abortController.abort();
        });

        process.on("SIGTERM", () => {
            this.logger.info("Received SIGTERM signal. Shutting down...");
            abortController.abort();
        });
        this.logger.debug("Signal handlers registered");

        try {
            for (const [orchestrator, _] of this.orchestrators.values()) {
                this.logger.info(`Starting orchestrator for chain ${orchestrator.chainId}...`);
                orchestratorProcesses.push(orchestrator.run(abortController.signal));
                this.logger.debug("Orchestrator process queued", { chainId: orchestrator.chainId });
            }

            this.logger.debug("Waiting for all orchestrator processes", {
                processCount: orchestratorProcesses.length,
            });
            await Promise.allSettled(orchestratorProcesses);
            this.logger.debug("All orchestrator processes completed");
        } catch (error) {
            this.logger.error(`Processor service failed: ${error}`);
            throw error;
        }
    }

    /**
     * Process retroactive events for all chains
     * - This is a blocking operation that will run until all retroactive events are processed
     */
    async processRetroactiveEvents(): Promise<void> {
        this.logger.info("Processing retroactive events...");
        for (const [_, retroactiveProcessor] of this.orchestrators.values()) {
            this.logger.debug("Starting retroactive processing", {
                chainId: retroactiveProcessor.chainId,
            });
            await retroactiveProcessor.processRetroactiveStrategies();
            this.logger.debug("Completed retroactive processing", {
                chainId: retroactiveProcessor.chainId,
            });
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
            this.logger.debug("Database resources released");
        } catch (error) {
            this.logger.error(`Error releasing resources: ${error}`);
        }
    }
}
