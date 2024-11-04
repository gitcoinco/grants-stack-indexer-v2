import { Orchestrator } from "@grants-stack-indexer/data-flow";
import { ChainId } from "@grants-stack-indexer/shared";

import { Environment } from "../config/env.js";
import { DependenciesService } from "./dependencies.service.js";
import { Logger } from "./logger.service.js";

export class ProcessorService {
    private readonly logger = new Logger();
    private readonly orchestrator: Orchestrator;

    constructor(private readonly env: Environment) {
        const { core, registries, indexerClient } = DependenciesService.initialize(
            env,
            this.logger,
        );

        this.orchestrator = new Orchestrator(
            env.CHAIN_ID as ChainId,
            core,
            indexerClient,
            registries,
            env.FETCH_LIMIT,
            env.FETCH_DELAY_MS,
        );
    }

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
}
