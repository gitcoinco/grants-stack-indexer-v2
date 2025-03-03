import axios from "axios";

import type { AnyIndexerFetchedEvent } from "@grants-stack-indexer/shared";

import type { GlobalTestState } from "./test-environment.js";
import { DatabaseManager } from "./database-manager.js";
import { ProcessingServiceManager } from "./processing-service.js";

/**
 * Configuration for test chains
 */
export interface TestChainConfig {
    id: number;
    name: string;
    rpcUrls: string[];
    fetchLimit?: number;
    fetchDelayMs?: number;
}

/**
 * TestHelper is a utility class for managing the test environment on a per-test-file scope
 * It provides methods for starting and stopping the processing service,
 * resetting the database, and adding events to the mock indexer
 *
 * Features:
 * - Processing service management
 * - Database management
 * - Event management
 * - Multi-chain support
 */
export class TestHelper {
    private processingService: ProcessingServiceManager | null = null;
    private databaseManager: DatabaseManager;

    /**
     * Constructor
     * @param globalState - The global state of the test environment
     */
    constructor(private readonly globalState: GlobalTestState) {
        this.databaseManager = new DatabaseManager();
    }

    /**
     * Starts the processing service
     * @param chains - Optional chain configurations to use
     */
    public async startProcessingService(chains?: TestChainConfig[]): Promise<void> {
        this.processingService = new ProcessingServiceManager({
            databaseUrl: this.globalState.databaseUrl,
            indexerGraphQLUrl: `${this.globalState.envioIndexerUrl}/v1/graphql`,
            indexerAdminSecret: "secret", // for mock server it's not used, so we passed a dummy value
            chains,
        });
        await this.processingService.start();
    }

    /**
     * Stops the processing service
     */
    public async stopProcessingService(): Promise<void> {
        if (this.processingService) {
            await this.processingService.stop();
            this.processingService = null;
        }
    }

    /**
     * Resets the database
     */
    public async resetDatabase(): Promise<void> {
        await this.databaseManager.resetDatabase(this.globalState.databaseUrl);
    }

    /**
     * Adds events to the mock indexer
     * @param events - The events to add
     */
    public async addEvents(events: AnyIndexerFetchedEvent[]): Promise<void> {
        const response = await axios.post(`${this.globalState.envioIndexerUrl}/events`, { events });

        if (response.status !== 200) {
            throw new Error(`Failed to add events: ${response.statusText}`);
        }
    }
}
