import type { TestProject } from "vitest/node";

import { TestEnvironment } from "../src/utils/test-environment.js";

/**
 * Delay in milliseconds to wait for the processing service to finish processing events
 */
export const PROCESSING_SERVICE_RUNNING_DELAY_MS = 10000;

let env: TestEnvironment | undefined;

/**
 * Global setup function for the test environment
 * @description This function is called once before all tests are run
 * @param project - The test project
 * @see https://vitest.dev/config/#globalsetup
 */
export async function setup(project: TestProject): Promise<void> {
    env = new TestEnvironment();
    await env.setupGlobal();

    project.provide("databaseUrl", env.getDatabaseConnectionString());
    project.provide("hasuraUrl", env.getApiHasuraUrl());
    project.provide("envioIndexerUrl", env.getMockIndexerUrl());
}

/**
 * Global teardown function for the test environment
 * @description This function is called once after all tests are run
 * @see https://vitest.dev/config/#globalsetup
 */
export async function teardown(): Promise<void> {
    if (!env) throw new Error("Test environment not initialized");
    await env.teardownGlobal();
}

/**
 * @see https://vitest.dev/config/#provide
 */
declare module "vitest" {
    export interface ProvidedContext {
        databaseUrl: string;
        hasuraUrl: string;
        hasuraAdminSecret: string;
        envioIndexerUrl: string;
    }
}
