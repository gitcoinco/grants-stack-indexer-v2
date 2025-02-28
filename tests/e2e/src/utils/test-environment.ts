import axios from "axios";
import { Client } from "pg";
import { Network, StartedNetwork } from "testcontainers";

import { MockEnvioIndexer } from "../mocks/envio-graphql-server.mock.js";
import { MOCK_ENVIO_INDEXER_PORT } from "./constants.js";
import { DatabaseManager } from "./database-manager.js";
import { HasuraApiContainer } from "./hasura-container.js";
import { ProcessingServiceManager } from "./processing-service.js";
import { TestDatabase } from "./test-database.js";

export interface GlobalTestState {
    databaseUrl: string;
    hasuraUrl: string;
    envioIndexerUrl: string;
}

/**
 * TestEnvironment orchestrates the setup and teardown of the global test environment components
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
     * Sets up the global test environment (database, Hasura API, and mock indexer)
     */
    public async setupGlobal(): Promise<void> {
        try {
            console.log("Setting up global test environment...");
            await this.setupNetwork();
            await this.setupGlobalServices();
            await this.verifyConnectivity();
            console.log("Global test environment setup complete!");
        } catch (error) {
            console.error("Failed to setup global test environment:", error);
            await this.teardownGlobal();
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
     * Sets up global services in the correct order
     * @private
     */
    private async setupGlobalServices(): Promise<void> {
        if (!this.network) throw new Error("Network not initialized");

        console.log("Starting database...");
        await this.database.start(this.network);

        console.log("Starting Hasura...");
        await this.apiHasura.start(this.network);

        console.log("Running migrations...");
        await this.databaseManager.runMigrations(this.database.getConnectionString());

        console.log("Setting up Hasura metadata...");
        await this.databaseManager.setupHasura(
            this.apiHasura.getUrl(),
            this.apiHasura.getAdminSecret(),
        );

        console.log("Starting mock Indexer server...");
        await this.indexerGraphQl.start();
    }

    /**
     * Verifies connectivity to all services
     * @private
     */
    private async verifyConnectivity(): Promise<void> {
        console.log("Verifying connectivity...");

        await Promise.all([
            this.verifyDatabaseConnectivity(),
            this.verifyExpressServerConnectivity(),
        ]);
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
     * Tears down the global test environment
     */
    public async teardownGlobal(): Promise<void> {
        await Promise.all([
            this.indexerGraphQl.stop(),
            this.apiHasura.stop(),
            this.database.stop(),
        ]);

        console.log("Global test environment teardown complete!");
    }

    public async resetDatabase(): Promise<void> {
        await this.databaseManager.resetDatabase(this.getDatabaseConnectionString());
    }

    /**
     * Gets the indexer GraphQL server mock
     */
    public getMockIndexerUrl(): string {
        return this.indexerGraphQl.getUrl();
    }

    /**
     * Gets the Test Database container
     */
    public getDatabaseConnectionString(): string {
        return this.database.getConnectionString();
    }

    /**
     * Gets the Hasura API container
     */
    public getApiHasuraUrl(): string {
        return this.apiHasura.getUrl();
    }
}
