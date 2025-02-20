import axios from "axios";
import { Client } from "pg";
import { Network, StartedNetwork } from "testcontainers";

import { ServiceNotStarted } from "../exceptions/index.js";
import { MockEnvioIndexer } from "../mocks/envio-graphql-server.mock.js";
import { MOCK_ENVIO_INDEXER_PORT } from "./constants.js";
import { DatabaseManager } from "./database-manager.js";
import { HasuraApiContainer } from "./hasura-container.js";
import { ProcessingServiceManager } from "./processing-service.js";
import { TestDatabase } from "./test-database.js";

/**
 * TestEnvironment orchestrates all components needed for integration testing.
 * It manages the lifecycle of containers, services, and network connections.
 *
 * Features:
 * - Container orchestration
 * - Network management
 * - Service coordination
 * - Health checking
 */
export class TestEnvironment {
    private readonly database: TestDatabase;
    private readonly apiHasura: HasuraApiContainer;
    private readonly indexerGraphQl: MockEnvioIndexer;
    private processingService: ProcessingServiceManager | null = null;
    private readonly databaseManager: DatabaseManager;
    private network: StartedNetwork | null = null;

    constructor() {
        this.database = new TestDatabase();
        this.apiHasura = new HasuraApiContainer(this.database);
        this.indexerGraphQl = new MockEnvioIndexer(MOCK_ENVIO_INDEXER_PORT);
        this.databaseManager = new DatabaseManager();
    }

    /**
     * Sets up the complete test environment
     */
    public async setup(): Promise<void> {
        try {
            console.log("Setting up test environment...");
            await this.setupNetwork();
            await this.setupServices();
            await this.verifyConnectivity();
            console.log("Test environment setup complete!");
        } catch (error) {
            console.error("Failed to setup test environment:", error);
            await this.teardown();
            process.exit(1);
        }
    }

    /**
     * Sets up the Docker network
     * @private
     */
    private async setupNetwork(): Promise<void> {
        this.network = await new Network().start();
        console.log("Network started", this.network.getId());
    }

    /**
     * Sets up all services in the correct order
     * @private
     */
    private async setupServices(): Promise<void> {
        if (!this.network) throw new Error("Network not initialized");

        console.log("Starting database...");
        await this.database.start(this.network);

        console.log("Starting Hasura...");
        await this.apiHasura.start(this.network);

        console.log("Running migrations...");
        this.databaseManager.runMigrations(this.database.getConnectionString());

        console.log("Setting up Hasura metadata...");
        this.databaseManager.setupHasura(this.apiHasura.getUrl(), this.apiHasura.getAdminSecret());

        console.log("Starting mock GraphQL server...");
        await this.indexerGraphQl.start();

        this.processingService = new ProcessingServiceManager({
            databaseUrl: this.database.getConnectionString(),
            indexerGraphQLUrl: this.indexerGraphQl.getGraphQlUrl(),
            indexerAdminSecret: "test-secret",
        });
        await this.processingService.start();
    }

    /**
     * Verifies connectivity to all services
     * @private
     */
    private async verifyConnectivity(): Promise<void> {
        console.log("Verifying connectivity...");

        await this.verifyDatabaseConnectivity();
        await this.verifyExpressServerConnectivity();
    }

    /**
     * Verifies database connectivity
     * @private
     */
    private async verifyDatabaseConnectivity(): Promise<void> {
        try {
            const client = new Client(this.database.getConnectionString());
            await client.connect();
            await client.query("SELECT 1");
            await client.end();
            console.log("Database connectivity: OK");
        } catch (error) {
            console.error("Database connectivity failed:", error);
            throw error;
        }
    }

    /**
     * Verifies Express server connectivity
     * @private
     */
    private async verifyExpressServerConnectivity(): Promise<void> {
        try {
            const response = await axios.get(`${this.indexerGraphQl.getUrl()}/health`);
            if (response.status === 200) {
                console.log("Express server connectivity: OK");
            } else {
                throw new Error(`Express server health check failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error("Express server connectivity failed:", error);
            throw error;
        }
    }

    /**
     * Tears down the test environment
     */
    public async teardown(): Promise<void> {
        await Promise.all([
            this.processingService?.stop(),
            this.indexerGraphQl.stop(),
            this.apiHasura.stop(),
            this.database.stop(),
        ]);
    }

    /**
     * Stops the processing service
     */
    public async stopProcessingService(): Promise<void> {
        if (!this.processingService) throw new ServiceNotStarted("Processing service");
        await this.processingService.stop();
    }

    /**
     * Gets the indexer GraphQL server mock
     */
    public getIndexerGraphQl(): MockEnvioIndexer {
        return this.indexerGraphQl;
    }

    /**
     * Gets the Test Database container
     */
    public getDatabase(): TestDatabase {
        return this.database;
    }

    /**
     * Gets the Hasura API container
     */
    public getApiHasura(): HasuraApiContainer {
        return this.apiHasura;
    }
}
