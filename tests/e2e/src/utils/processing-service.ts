import { ChildProcess, spawn } from "child_process";
import path from "path";

import { StartupFailed } from "../exceptions/index.js";
import { BASE_NODE_ENV_VARS } from "./constants.js";

/**
 * Configuration interface for the Processing Service
 */
interface ProcessingServiceConfig {
    databaseUrl: string;
    indexerGraphQLUrl: string;
    indexerAdminSecret: string;
    logLevel?: string;
    nodeEnv?: string;
}

/**
 * ProcessingService manages the lifecycle of the processing service in the test environment.
 * It handles starting, stopping, and monitoring the service process.
 *
 * Features:
 * - Clean environment setup
 * - Process lifecycle management
 * - Configurable service parameters
 * - Startup validation
 *
 * @example
 * ```typescript
 * const config = {
 *   databaseUrl: "postgresql://...",
 *   indexerGraphQLUrl: "http://localhost:4000/v1/graphql",
 *   indexerAdminSecret: "test-secret"
 * };
 *
 * const service = new ProcessingService(config);
 * await service.start();
 * await service.stop();
 * ```
 */
export class ProcessingServiceManager {
    private process: ChildProcess | null = null;
    private readonly processingPath: string;
    private CHAIN_ID: number = 1;

    constructor(private readonly config: ProcessingServiceConfig) {
        this.processingPath = path.resolve(__dirname, "../../../../apps/processing");
    }

    /**
     * Starts the processing service with the configured environment
     * @throws {Error} If the service fails to start within the timeout period
     */
    public async start(): Promise<void> {
        const testEnv = this.createEnvironment();

        return new Promise((resolve, reject) => {
            this.process = spawn("pnpm", ["start"], {
                cwd: this.processingPath,
                stdio: "pipe",
                env: testEnv,
                shell: true,
            });

            this.setupProcessHandlers(resolve, reject);
            this.setupTimeout(reject);
        });
    }

    /**
     * Creates the environment configuration for the processing service
     * @private
     */
    private createEnvironment(): NodeJS.ProcessEnv {
        return {
            // Database
            DATABASE_URL: this.config.databaseUrl,
            DATABASE_SCHEMA: "public",

            // Chain Configuration
            CHAINS: `[{"id":${this.CHAIN_ID},"name":"mainnet","rpcUrls":["https://eth.llamarpc.com","https://rpc.flashbots.net/fast"],"fetchLimit":30,"fetchDelayMs":50}]`,

            // Logging
            LOG_LEVEL: this.config.logLevel ?? "debug",
            NODE_ENV: this.config.nodeEnv ?? "development",

            // Indexer Configuration
            INDEXER_GRAPHQL_URL: this.config.indexerGraphQLUrl,
            INDEXER_ADMIN_SECRET: this.config.indexerAdminSecret,

            // IPFS Configuration
            METADATA_SOURCE: "public-gateway",
            PUBLIC_GATEWAY_URLS: JSON.stringify([
                "https://ipfs.io",
                "https://dweb.link",
                "https://cloudflare-ipfs.com",
                "https://gateway.pinata.cloud",
                "https://ipfs.infura.io",
                "https://ipfs.fleek.co",
                "https://ipfs.eth.aragon.network",
                "https://ipfs.jes.xxx",
                "https://ipfs.lol",
                "https://ipfs.mle.party",
            ]),

            // Pricing Configuration
            PRICING_SOURCE: "dummy",

            // Retry Configuration
            RETRY_MAX_ATTEMPTS: "3",
            RETRY_BASE_DELAY_MS: "1000",
            RETRY_FACTOR: "2",
            RETRY_MAX_DELAY_MS: "5000",

            // Notifier Configuration
            NOTIFIER_PROVIDER: "null",

            // Path related env vars
            PWD: this.processingPath,
            ...BASE_NODE_ENV_VARS,
        };
    }

    /**
     * Sets up process event handlers
     * @private
     */
    private setupProcessHandlers(resolve: () => void, reject: (error: Error) => void): void {
        if (!this.process) return;

        this.process.stdout?.on("data", (data) => {
            const output = (data as Buffer).toString();
            if (output.includes(`Starting orchestrator for chain ${this.CHAIN_ID}`)) {
                resolve();
            }
        });

        this.process.on("error", (err) => {
            reject(new StartupFailed("Processing service", err));
        });

        this.process.on("exit", (code) => {
            if (code !== null && code !== 0) {
                console.error(`[Processing Service] Exited with code ${code}`);
            }
        });
    }

    /**
     * Sets up the startup timeout
     * @private
     */
    private setupTimeout(reject: (error: Error) => void): void {
        setTimeout(() => {
            reject(
                new StartupFailed(
                    "Processing service",
                    new Error("Failed to start within timeout"),
                ),
            );
        }, 30000);
    }

    /**
     * Stops the processing service
     */
    public async stop(): Promise<void> {
        if (this.process && !this.process.killed) {
            this.process.kill("SIGKILL");
            await new Promise<void>((resolve) => {
                this.process?.on("exit", () => resolve());
            });
            this.process = null;
        }
    }

    /**
     * Checks if the processing service is running
     */
    public isRunning(): boolean {
        return this.process !== null && !this.process.killed;
    }
}
