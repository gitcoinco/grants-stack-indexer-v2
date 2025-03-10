import { createServer, Server } from "http";
import express, { Application, Request, RequestHandler, Response } from "express";

import type { AnyIndexerFetchedEvent } from "@grants-stack-indexer/shared";

/**
 * Interface representing the structure of a GraphQL request body
 */
interface GraphQLRequest {
    query: string;
    variables?: Record<string, unknown>;
}

/**
 * MockEnvioIndexer simulates the Envio Indexer GraphQL API for testing purposes.
 * It provides endpoints that match the production Envio Indexer API but returns controlled test data through an Express server.
 *
 * Features:
 * - Health check endpoint (/health)
 * - GraphQL endpoint (/v1/graphql)
 * - Event storage and retrieval
 * - Port availability checking
 *
 * @example
 * ```typescript
 * const mockServer = new MockGraphQLServer(4000);
 * await mockServer.start();
 *
 * // Add test events
 * mockServer.addEvents([...]);
 *
 * // Clean up
 * await mockServer.stop();
 * ```
 */
export class MockEnvioIndexer {
    private readonly app: Application;
    private server: Server | undefined;
    private readonly port: number;
    private events: AnyIndexerFetchedEvent[] = [];

    /**
     * Creates a new instance of MockGraphQLServer
     * @param port - The port number to run the server on (defaults to 4000)
     */
    constructor(port: number = 4000) {
        this.port = port;
        this.app = this.configureServer();
    }

    /**
     * Configures the Express server with all necessary middleware and routes
     * @private
     */
    private configureServer(): Application {
        const app = express();
        app.use(express.json());

        // Configure routes
        app.get("/health", this.healthCheckHandler);
        app.post("/v1/graphql", this.createGraphQLHandler());
        app.post("/events", this.addEventsHandler.bind(this));

        return app;
    }

    /**
     * Handles health check requests
     * @private
     */
    private healthCheckHandler: RequestHandler = (_: Request, res: Response): void => {
        res.send("OK");
    };

    /**
     * Creates the GraphQL endpoint handler
     * @private
     */
    private createGraphQLHandler(): RequestHandler {
        return (req: Request, res: Response): void => {
            const { query, variables } = req.body as GraphQLRequest;

            if (query.includes("getTotalEventsInBlock")) {
                res.json({
                    data: {
                        last_block_events: {
                            aggregate: { count: 0 },
                            nodes: [],
                        },
                    },
                });
                return;
            }

            // Extract chainId from variables if present, fallback to query string extraction
            const chainId = variables?.chainId
                ? Number(variables.chainId)
                : ((): number | null => {
                      const chainIdMatch = query.match(/chainId:\s*(\d+)/);
                      return chainIdMatch ? parseInt(chainIdMatch[1]!, 10) : null;
                  })();

            // Filter events by chainId if specified
            const events = chainId
                ? [...this.events].filter((event) => event.chainId === chainId)
                : [...this.events];

            // remove filtered events from the original events array
            this.events = this.events.filter((event) => !events.includes(event));

            if (
                query.includes("getEventsAfterBlockNumberAndLogIndex") ||
                query.includes("getEvents")
            ) {
                res.json({ data: { raw_events: events } });
                return;
            }

            res.json({ data: null });
        };
    }

    /**
     * Handles adding events via REST endpoint
     * @private
     */
    private addEventsHandler: RequestHandler = (
        req: Request<object, object, { events: AnyIndexerFetchedEvent[] }>,
        res: Response,
    ): void => {
        const events = req.body.events as AnyIndexerFetchedEvent[];
        if (!Array.isArray(events)) {
            res.status(400).json({ error: "Invalid events format. Expected array." });
            return;
        }
        this.events.push(...events);
        res.status(200).json({ message: "Events added successfully" });
    };

    /**
     * Adds events to the mock server's event store
     * @param events - Array of events to add
     */
    public addEvents(events: AnyIndexerFetchedEvent[]): void {
        this.events.push(...events);
    }

    /**
     * Starts the mock server
     * @throws {Error} If the port is already in use
     */
    public async start(): Promise<void> {
        await this.checkPortAvailability();
        await this.startServer();
    }

    /**
     * Checks if the configured port is available
     * @private
     */
    private async checkPortAvailability(): Promise<void> {
        return new Promise((resolve, reject) => {
            const testServer = createServer();

            testServer.once("error", (err: NodeJS.ErrnoException) => {
                if (err.code === "EADDRINUSE") {
                    reject(
                        new Error(
                            `Port ${this.port} is already in use. Please ensure previous test servers are properly closed.`,
                        ),
                    );
                } else {
                    reject(err);
                }
                testServer.close();
            });

            testServer.once("listening", () => {
                testServer.close(() => resolve());
            });

            testServer.listen(this.port, "0.0.0.0");
        });
    }

    /**
     * Starts the actual server after port check
     * @private
     */
    private async startServer(): Promise<void> {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, "0.0.0.0", () => {
                console.log(`Mock Indexer Express server started on http://0.0.0.0:${this.port}`);
                resolve();
            });
        });
    }

    /**
     * Stops the mock server and cleans up resources
     */
    public async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((err) => {
                    if (err) reject(err);
                    else {
                        this.server = undefined;
                        this.events = [];
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Gets the base URL of the mock server
     */
    public getUrl(): string {
        return `http://0.0.0.0:${this.port}`;
    }

    /**
     * Gets the GraphQL endpoint URL
     */
    public getGraphQlUrl(): string {
        return `${this.getUrl()}/v1/graphql`;
    }

    /**
     * Gets the port number the server is running on
     */
    public getPort(): number {
        return this.port;
    }
}
