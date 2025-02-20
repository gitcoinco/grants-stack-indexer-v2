import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { StartedNetwork } from "testcontainers";

import { ServiceNotStarted } from "../exceptions/index.js";

export class TestDatabase {
    private container: StartedPostgreSqlContainer | null = null;
    private network: StartedNetwork | null = null;

    /**
     * Starts the Test Database container
     * @param network - The started network
     */
    async start(network: StartedNetwork): Promise<void> {
        this.network = network;

        this.container = await new PostgreSqlContainer()
            .withUsername("test")
            .withPassword("test")
            .withDatabase("test")
            .withNetwork(network)
            .withNetworkAliases("postgres") // This is important for internal access
            .start();

        console.log(
            `Database started on ${this.container.getHost()}:${this.container.getMappedPort(5432)}`,
        );
    }

    /**
     * Stops the Test Database container
     */
    async stop(): Promise<void> {
        if (this.container) {
            await this.container.stop();
            this.container = null;
        }
    }

    /**
     * Gets the database container
     * @throws {ServiceNotStarted} If the container is not started
     */
    getContainer(): StartedPostgreSqlContainer {
        if (!this.container) {
            throw new ServiceNotStarted("Database container");
        }
        return this.container;
    }

    /**
     * Gets the Test Database connection string
     * @throws {ServiceNotStarted} If the container is not started
     */
    getConnectionString(): string {
        // External connection string (for host machine)
        if (!this.container) {
            throw new ServiceNotStarted("Database container");
        }
        return `postgresql://test:test@${this.container.getHost()}:${this.container.getMappedPort(5432)}/test`;
    }

    /**
     * Gets the Test Database internal connection string
     * @throws {ServiceNotStarted} If the container is not started
     */
    getInternalConnectionString(): string {
        // Internal connection string (for docker network)
        if (!this.container) {
            throw new ServiceNotStarted("Database container");
        }
        return `postgresql://test:test@postgres:5432/test`;
    }
}
