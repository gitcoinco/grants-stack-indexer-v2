import { optimism } from "viem/chains";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { Orchestrator } from "@grants-stack-indexer/data-flow";
import { ChainId, Logger } from "@grants-stack-indexer/shared";

import { Environment } from "../config/env.js";
import { SharedDependencies, SharedDependenciesService } from "./index.js";

/**
 * Processor service application
 * - Initializes core dependencies (repositories, providers) via SharedDependenciesService
 * - Sets up EVM provider with configured RPC endpoints
 * - Creates an Orchestrator instance to coordinate an specific chain:
 *   - Fetching on-chain events via indexer client
 *   - Processing events through registered handlers
 *   - Storing processed data in PostgreSQL via repositories
 * - Manages graceful shutdown on termination signals
 *
 * TODO: support multichain
 */
export class ProcessingService {
    private readonly logger = Logger.getInstance();
    private readonly orchestrator: Orchestrator;
    private readonly kyselyDatabase: SharedDependencies["kyselyDatabase"];

    constructor(private readonly env: Environment) {
        const { core, registries, indexerClient, kyselyDatabase } =
            SharedDependenciesService.initialize(env, this.logger);
        this.kyselyDatabase = kyselyDatabase;

        // Initialize EVM provider
        const evmProvider = new EvmProvider(env.RPC_URLS, optimism, this.logger);

        this.orchestrator = new Orchestrator(
            env.CHAIN_ID as ChainId,
            { ...core, evmProvider },
            indexerClient,
            registries,
            env.FETCH_LIMIT,
            env.FETCH_DELAY_MS,
            this.logger,
        );
    }

    /**
     * Start the processor service
     *
     * The processor runs indefinitely until it is terminated.
     */
    async start(): Promise<void> {
        this.logger.info("Starting processor service...");

        const abortController = new AbortController();

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
            await this.orchestrator.run(abortController.signal);
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
