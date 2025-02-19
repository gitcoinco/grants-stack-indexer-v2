import {
    GenericContainer,
    StartedNetwork,
    StartedTestContainer,
    Wait,
    WaitStrategy,
} from "testcontainers";

import { TestDatabase } from "./test-database.js";

/**
 * Configuration interface for Hasura container environment variables
 */
interface HasuraConfig {
    readonly HASURA_PORT: number;
    readonly ADMIN_SECRET: string;
    readonly CONSOLE_ENABLED: boolean;
    readonly DEV_MODE: boolean;
    readonly LOG_TYPES: string[];
    readonly STARTUP_TIMEOUT: number;
}

/**
 * HasuraContainer manages a Hasura GraphQL Engine container for testing purposes.
 * It provides a configured Hasura instance that connects to a test database and
 * exposes GraphQL endpoints for testing.
 *
 * Features:
 * - Automated container lifecycle management
 * - Configurable environment variables
 * - Health check and startup validation
 * - Network integration with test database
 *
 * @example
 * ```typescript
 * const database = new TestDatabase();
 * const hasura = new HasuraContainer(database);
 *
 * // Start container
 * await hasura.start(network);
 *
 * // Use GraphQL endpoint
 * const endpoint = hasura.getGraphQlUrl();
 *
 * // Clean up
 * await hasura.stop();
 * ```
 */
export class HasuraApiContainer {
    private container: StartedTestContainer | null = null;
    private static readonly DEFAULT_CONFIG: HasuraConfig = {
        HASURA_PORT: 8080,
        ADMIN_SECRET: "test-secret",
        CONSOLE_ENABLED: true,
        DEV_MODE: true,
        LOG_TYPES: ["startup", "http-log", "webhook-log", "websocket-log", "query-log"],
        STARTUP_TIMEOUT: 30000,
    };

    /**
     * Creates a new Hasura container instance
     * @param database - The test database instance to connect to
     * @param config - Optional configuration overrides
     */
    constructor(
        private readonly database: TestDatabase,
        private readonly config: HasuraConfig = HasuraApiContainer.DEFAULT_CONFIG,
    ) {}

    /**
     * Starts the Hasura container with the specified configuration
     * @param network - The Docker network to attach the container to
     * @throws {Error} If the container fails to start or health checks fail
     */
    public async start(network: StartedNetwork): Promise<void> {
        try {
            this.container = await this.createContainer(network);
            console.log("Hasura container started", this.container.getId());
        } catch (error) {
            throw new Error(`Failed to start Hasura container: ${error}`);
        }
    }

    /**
     * Creates and configures the Hasura container
     * @private
     */
    private async createContainer(network: StartedNetwork): Promise<StartedTestContainer> {
        return new GenericContainer("hasura/graphql-engine:v2.23.0")
            .withExposedPorts(this.config.HASURA_PORT)
            .withEnvironment(this.getEnvironmentVariables())
            .withWaitStrategy(this.getWaitStrategy())
            .withNetwork(network)
            .start();
    }

    /**
     * Generates the environment variables for the Hasura container
     * @private
     */
    private getEnvironmentVariables(): Record<string, string> {
        return {
            HASURA_GRAPHQL_DATABASE_URL: this.database.getInternalConnectionString(),
            HASURA_GRAPHQL_ENABLE_CONSOLE: String(this.config.CONSOLE_ENABLED),
            HASURA_GRAPHQL_ADMIN_SECRET: this.config.ADMIN_SECRET,
            HASURA_GRAPHQL_UNAUTHORIZED_ROLE: "public",
            HASURA_GRAPHQL_CORS_DOMAIN: "*",
            HASURA_GRAPHQL_ENABLE_TELEMETRY: "false",
            HASURA_GRAPHQL_DEV_MODE: String(this.config.DEV_MODE),
            HASURA_GRAPHQL_ENABLED_LOG_TYPES: this.config.LOG_TYPES.join(", "),
            HASURA_GRAPHQL_ADMIN_INTERNAL_ERRORS: "true",
            HASURA_GRAPHQL_EXPERIMENTAL_FEATURES: "naming_convention",
            HASURA_GRAPHQL_DEFAULT_NAMING_CONVENTION: "graphql-default",
        };
    }

    /**
     * Configures the wait strategy for container startup
     * @private
     */
    private getWaitStrategy(): WaitStrategy {
        return Wait.forAll([
            Wait.forListeningPorts(),
            Wait.forHttp("/healthz", this.config.HASURA_PORT)
                .forStatusCode(200)
                .withStartupTimeout(this.config.STARTUP_TIMEOUT),
        ]);
    }

    /**
     * Stops the Hasura container and cleans up resources
     */
    public async stop(): Promise<void> {
        if (this.container) {
            await this.container.stop();
            this.container = null;
        }
    }

    /**
     * Gets the base URL for the Hasura instance
     * @throws {Error} If the container is not started
     */
    public getUrl(): string {
        if (!this.container) {
            throw new Error("Hasura container not started");
        }

        const mappedPort = this.container.getMappedPort(this.config.HASURA_PORT);
        return `http://localhost:${mappedPort}`;
    }

    /**
     * Gets the GraphQL endpoint URL
     * @throws {Error} If the container is not started
     */
    public getGraphQlUrl(): string {
        return `${this.getUrl()}/v1/graphql`;
    }

    /**
     * Gets the admin secret for Hasura authentication
     */
    public getAdminSecret(): string {
        return this.config.ADMIN_SECRET;
    }

    /**
     * Checks if the container is running
     */
    public isRunning(): boolean {
        return this.container !== null;
    }
}
