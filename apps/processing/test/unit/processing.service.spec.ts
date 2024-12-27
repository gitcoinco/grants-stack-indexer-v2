import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import {
    DatabaseEventRegistry,
    DatabaseStrategyRegistry,
    InMemoryCachedEventRegistry,
    InMemoryCachedStrategyRegistry,
    Orchestrator,
    RetroactiveProcessor,
} from "@grants-stack-indexer/data-flow";

import type { Environment } from "../../src/config/env.js";
import { ProcessingService } from "../../src/services/processing.service.js";

vi.mock("../../src/services/sharedDependencies.service.js", () => ({
    SharedDependenciesService: {
        initialize: vi.fn(() => ({
            core: {},
            registriesRepositories: {},
            indexerClient: {},
            kyselyDatabase: {
                destroy: vi.fn(),
            },
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
            },
        })),
    },
}));

vi.mock("@grants-stack-indexer/chain-providers", () => ({
    EvmProvider: vi.fn(),
}));

vi.mock("@grants-stack-indexer/data-flow", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@grants-stack-indexer/data-flow")>();
    const mockStrategyRegistry = {
        getStrategies: vi.fn(),
        getStrategyId: vi.fn(),
        saveStrategyId: vi.fn(),
    };

    const mockEventRegistry = {
        getLastProcessedEvent: vi.fn(),
        saveLastProcessedEvent: vi.fn(),
    };

    return {
        ...actual,
        InMemoryCachedStrategyRegistry: {
            initialize: vi.fn().mockResolvedValue(mockStrategyRegistry),
        },
        DatabaseStrategyRegistry: vi.fn().mockImplementation(() => ({
            getStrategies: vi.fn(),
            getStrategyId: vi.fn(),
            saveStrategyId: vi.fn(),
        })),
        DatabaseEventRegistry: vi.fn().mockImplementation(() => ({
            getLastProcessedEvent: vi.fn(),
            saveLastProcessedEvent: vi.fn(),
        })),
        InMemoryCachedEventRegistry: {
            initialize: vi.fn().mockResolvedValue(mockEventRegistry),
        },
    };
});

vi.spyOn(Orchestrator.prototype, "run").mockImplementation(async function (signal: AbortSignal) {
    while (!signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
});
vi.spyOn(RetroactiveProcessor.prototype, "processRetroactiveStrategies").mockImplementation(
    async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
    },
);

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

    beforeEach(async () => {
        vi.clearAllMocks();
        processingService = await ProcessingService.initialize(mockEnv as Environment);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("start", () => {
        it("initializes multiple orchestrators correctly", () => {
            expect(DatabaseStrategyRegistry).toHaveBeenCalledTimes(1);
            expect(DatabaseEventRegistry).toHaveBeenCalledTimes(1);
            expect(EvmProvider).toHaveBeenCalledTimes(2);
            expect(InMemoryCachedStrategyRegistry.initialize).toHaveBeenCalledTimes(2);
            expect(InMemoryCachedEventRegistry.initialize).toHaveBeenCalledTimes(2);

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

    describe("retroactiveProcessing", () => {
        it("processes retroactive strategies", async () => {
            const runSpy = vi.mocked(RetroactiveProcessor.prototype.processRetroactiveStrategies);

            await processingService.processRetroactiveEvents();

            // Verify both retroactive processors were run
            expect(runSpy).toHaveBeenCalledTimes(2);
        });
    });
});
