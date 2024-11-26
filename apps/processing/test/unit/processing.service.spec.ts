import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { Orchestrator } from "@grants-stack-indexer/data-flow";

import type { Environment } from "../../src/config/env.js";
import { ProcessingService } from "../../src/services/processing.service.js";

vi.mock("../../src/services/sharedDependencies.service.js", () => ({
    SharedDependenciesService: {
        initialize: vi.fn(() => ({
            core: {},
            registries: {},
            indexerClient: {},
            kyselyDatabase: {
                destroy: vi.fn(),
            },
        })),
    },
}));

vi.mock("@grants-stack-indexer/chain-providers", () => ({
    EvmProvider: vi.fn(),
}));

vi.spyOn(Orchestrator.prototype, "run").mockImplementation(async function (signal: AbortSignal) {
    while (!signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
});

describe("ProcessingService", () => {
    let processingService: ProcessingService;
    const mockEnv: Pick<Environment, "CHAINS" | "DATABASE_URL" | "DATABASE_SCHEMA"> = {
        CHAINS: [
            {
                id: 1,
                rpcUrls: ["http://localhost:8545"],
                name: "Chain 1",
                fetchLimit: 100,
                fetchDelayMs: 1000,
            },
            {
                id: 2,
                rpcUrls: ["http://localhost:8546"],
                name: "Chain 2",
                fetchLimit: 200,
                fetchDelayMs: 2000,
            },
        ],
        DATABASE_URL: "postgresql://localhost:5432/test",
        DATABASE_SCHEMA: "public",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        processingService = new ProcessingService(mockEnv as Environment);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("initializes multiple orchestrators correctly", () => {
        expect(EvmProvider).toHaveBeenCalledTimes(2);
        // Verify orchestrators were created with correct parameters
        expect(processingService["orchestrators"].size).toBe(2);

        // Verify first chain initialization
        expect(EvmProvider).toHaveBeenNthCalledWith(
            1,
            ["http://localhost:8545"],
            expect.any(Object),
            expect.any(Object),
        );

        // Verify second chain initialization
        expect(EvmProvider).toHaveBeenNthCalledWith(
            2,
            ["http://localhost:8546"],
            expect.any(Object),
            expect.any(Object),
        );
    });

    it("starts all orchestrators and handles shutdown signals", async () => {
        const abortSpy = vi.spyOn(AbortController.prototype, "abort");
        const runSpy = vi.mocked(Orchestrator.prototype.run);
        const logSpy = vi.spyOn(processingService["logger"], "info");

        const startPromise = processingService.start();

        // Wait for orchestrators to start
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify both orchestrators are running
        // const orchestratorInstances = vi.mocked(Orchestrator).mock.results;
        // Verify both orchestrators are running
        expect(runSpy).toHaveBeenCalledTimes(2);
        expect(runSpy.mock.calls.map((call) => call[0])).toEqual([
            expect.any(AbortSignal),
            expect.any(AbortSignal),
        ]);
        expect(logSpy).toHaveBeenNthCalledWith(2, "Starting orchestrator for chain 1...");
        expect(logSpy).toHaveBeenNthCalledWith(3, "Starting orchestrator for chain 2...");

        // Simulate SIGINT
        process.emit("SIGINT");
        expect(abortSpy).toHaveBeenCalled();

        // Wait for orchestrators to shut down
        await startPromise;

        // Verify all orchestrators were properly shut down
        expect(runSpy.mock.results.every((result) => result.value)).toBeTruthy();
    });

    it("handles SIGTERM signal", async () => {
        const abortSpy = vi.spyOn(AbortController.prototype, "abort");
        const startPromise = processingService.start();
        const runSpy = vi.mocked(Orchestrator.prototype.run);

        // Wait for orchestrators to start
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Simulate SIGTERM
        process.emit("SIGTERM");
        expect(abortSpy).toHaveBeenCalled();

        await startPromise;

        // Verify all orchestrators were properly shut down
        expect(runSpy.mock.results.every((result) => result.value)).toBeTruthy();
    });

    it("releases resources correctly", async () => {
        await processingService.releaseResources();

        expect(processingService["kyselyDatabase"].destroy).toHaveBeenCalled();
    });

    it("logs error during resource release", async () => {
        const mockError = new Error("Database error");
        const logSpy = vi.spyOn(processingService["logger"], "error");
        vi.mocked(processingService["kyselyDatabase"].destroy).mockRejectedValueOnce(mockError);

        await processingService.releaseResources();

        expect(logSpy).toHaveBeenCalledWith(`Error releasing resources: ${mockError}`);
    });
});
