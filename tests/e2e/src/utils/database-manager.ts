import { exec } from "child_process";
import path from "path";
import { promisify } from "util";

import { BASE_NODE_ENV_VARS, DATABASE_SCHEMA } from "./constants.js";

const execAsync = promisify(exec);

/**
 * DatabaseManager handles database migrations and Hasura metadata setup
 * for the test environment.
 *
 * Features:
 * - Database migrations
 * - Hasura metadata configuration
 * - Database reset
 * - Clean environment execution
 */
export class DatabaseManager {
    private readonly migrationsPath: string;
    private readonly hasuraPath: string;

    constructor() {
        this.migrationsPath = path.resolve(__dirname, "../../../../scripts/migrations");
        this.hasuraPath = path.resolve(__dirname, "../../../../scripts/hasura-config");
    }

    /**
     * Runs database migrations
     * @param databaseUrl - The database connection URL
     */
    public async runMigrations(databaseUrl: string): Promise<void> {
        const migrationsEnv = this.createEnvironment(databaseUrl);

        await Promise.all([
            this.execMigration("db:cache:migrate", migrationsEnv),
            this.execMigration("db:migrate", migrationsEnv),
        ]);
    }

    /**
     * Resets the database by migrating down and up
     * @param databaseUrl - The database connection URL
     */
    public async resetDatabase(databaseUrl: string): Promise<void> {
        const migrationsEnv = this.createEnvironment(databaseUrl);

        // First reset both databases in parallel
        await Promise.all([
            this.execMigration("db:cache:reset", migrationsEnv),
            this.execMigration("db:reset", migrationsEnv),
        ]);

        // Then run migrations in parallel
        await Promise.all([
            this.execMigration("db:cache:migrate", migrationsEnv),
            this.execMigration("db:migrate", migrationsEnv),
        ]);
    }

    /**
     * Sets up Hasura metadata
     * @param hasuraUrl - The Hasura instance URL
     * @param adminSecret - The Hasura admin secret
     */
    public async setupHasura(hasuraUrl: string, adminSecret: string): Promise<void> {
        const hasuraEnv = {
            HASURA_ENDPOINT: hasuraUrl,
            HASURA_ADMIN_SECRET: adminSecret,
            HASURA_SCHEMA: DATABASE_SCHEMA,
            PWD: this.hasuraPath,
            ...BASE_NODE_ENV_VARS,
        };

        await this.execMigration("api:configure", hasuraEnv, this.hasuraPath);
    }

    /**
     * Creates the environment configuration for migrations
     * @private
     */
    private createEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
        return {
            DATABASE_URL: databaseUrl,
            DATABASE_SCHEMA,
            PWD: this.migrationsPath,
            ...BASE_NODE_ENV_VARS,
        };
    }

    /**
     * Executes a migration command
     * @private
     */
    private async execMigration(
        command: string,
        env: NodeJS.ProcessEnv,
        cwd: string = this.migrationsPath,
    ): Promise<void> {
        try {
            await execAsync(`pnpm ${command} --schema=${DATABASE_SCHEMA}`, {
                cwd,
                env,
            });
        } catch (error) {
            console.error(`Failed to execute ${command}:`, error);
            throw error;
        }
    }
}
