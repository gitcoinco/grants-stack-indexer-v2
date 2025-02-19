import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { StartedNetwork } from "testcontainers";

export class TestDatabase {
    private container: StartedPostgreSqlContainer | null = null;
    private network: StartedNetwork | null = null;

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

    async stop(): Promise<void> {
        if (this.container) {
            await this.container.stop();
            this.container = null;
        }
    }

    getContainer(): StartedPostgreSqlContainer {
        if (!this.container) {
            throw new Error("Database container not started");
        }
        return this.container;
    }

    getConnectionString(): string {
        // External connection string (for host machine)
        if (!this.container) {
            throw new Error("Database container not started");
        }
        return `postgresql://test:test@${this.container.getHost()}:${this.container.getMappedPort(5432)}/test`;
    }

    getInternalConnectionString(): string {
        // Internal connection string (for docker network)
        if (!this.container) {
            throw new Error("Database container not started");
        }
        return `postgresql://test:test@postgres:5432/test`;
    }
}
