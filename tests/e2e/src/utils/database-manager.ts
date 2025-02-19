import { execSync } from "child_process";
import path from "path";

import { BASE_NODE_ENV_VARS, DATABASE_SCHEMA } from "./constants.js";

/**
 * DatabaseManager handles database migrations and Hasura metadata setup
 * for the test environment.
 *
 * Features:
 * - Database migrations
 * - Hasura metadata configuration
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
    public runMigrations(databaseUrl: string): void {
        const migrationsEnv = {
            DATABASE_URL: databaseUrl,
            DATABASE_SCHEMA: DATABASE_SCHEMA,
            PWD: this.migrationsPath,
            ...BASE_NODE_ENV_VARS,
        };

        execSync(`pnpm db:cache:migrate --schema=${DATABASE_SCHEMA}`, {
            cwd: this.migrationsPath,
            stdio: "pipe",
            env: migrationsEnv,
        });

        execSync(`pnpm db:migrate --schema=${DATABASE_SCHEMA}`, {
            cwd: this.migrationsPath,
            stdio: "pipe",
            env: migrationsEnv,
        });
    }

    /**
     * Sets up Hasura metadata
     * @param hasuraUrl - The Hasura instance URL
     * @param adminSecret - The Hasura admin secret
     */
    public setupHasura(hasuraUrl: string, adminSecret: string): void {
        const hasuraEnv = {
            HASURA_ENDPOINT: hasuraUrl,
            HASURA_ADMIN_SECRET: adminSecret,
            HASURA_SCHEMA: DATABASE_SCHEMA,
            PWD: this.hasuraPath,
            ...BASE_NODE_ENV_VARS,
        };

        execSync("pnpm api:configure", {
            cwd: this.hasuraPath,
            stdio: "pipe",
            env: hasuraEnv,
        });
    }
}
