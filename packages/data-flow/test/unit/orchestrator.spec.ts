import { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { UnsupportedStrategy } from "@grants-stack-indexer/processors";
import {
    Changeset,
    IApplicationRepository,
    IProjectRepository,
    IRoundRepository,
} from "@grants-stack-indexer/repository";
import {
    AlloEvent,
    ChainId,
    ContractName,
    ContractToEventName,
    EventParams,
    Hex,
    ProcessorEvent,
    StrategyEvent,
    stringify,
} from "@grants-stack-indexer/shared";

import {
    CoreDependencies,
    IEventsRegistry,
    InvalidEvent,
    IStrategyRegistry,
} from "../../src/internal.js";
import { Orchestrator } from "../../src/orchestrator.js";

vi.mock("../../src/eventsProcessor.js", () => {
    const EventsProcessor = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    EventsProcessor.prototype.processEvent = vi.fn();
    return {
        EventsProcessor,
    };
});
vi.mock("../../src/data-loader/dataLoader.js", () => {
    const DataLoader = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    DataLoader.prototype.applyChanges = vi.fn();
    return {
        DataLoader,
    };
});

describe("Orchestrator", { sequential: true }, () => {
    let orchestrator: Orchestrator;
    let mockIndexerClient: IIndexerClient;
    let mockEventsRegistry: IEventsRegistry;
    let mockStrategyRegistry: IStrategyRegistry;
    let mockEvmProvider: EvmProvider;
    let abortController: AbortController;
    let runPromise: Promise<void> | undefined;

    const chainId = 1 as ChainId;
    const mockFetchLimit = 10;
    const mockFetchDelay = 100;

    beforeEach(() => {
        // Setup mock implementations
        mockIndexerClient = {
            getEventsAfterBlockNumberAndLogIndex: vi.fn(),
        } as unknown as IIndexerClient;

        mockEventsRegistry = {
            getLastProcessedEvent: vi.fn(),
            saveLastProcessedEvent: vi.fn(),
        };

        mockStrategyRegistry = {
            getStrategyId: vi.fn(),
            saveStrategyId: vi.fn(),
        };

        mockEvmProvider = {
            readContract: vi.fn(),
        } as unknown as EvmProvider;

        const dependencies: CoreDependencies = {
            evmProvider: mockEvmProvider,
            projectRepository: {} as unknown as IProjectRepository,
            roundRepository: {} as unknown as IRoundRepository,
            applicationRepository: {} as unknown as IApplicationRepository,
            pricingProvider: {
                getTokenPrice: vi.fn(),
            },
            metadataProvider: {
                getMetadata: vi.fn(),
            },
        };

        abortController = new AbortController();

        orchestrator = new Orchestrator(
            chainId,
            dependencies,
            mockIndexerClient,
            {
                eventsRegistry: mockEventsRegistry,
                strategyRegistry: mockStrategyRegistry,
            },
            mockFetchLimit,
            mockFetchDelay,
        );
    });

    afterEach(async () => {
        vi.clearAllMocks();

        abortController.abort();

        await runPromise;

        runPromise = undefined;
    });

    describe("Event Processing Flow", () => {
        it("process events in the correct order", async () => {
            const mockEvents = [
                createMockEvent("Allo", "PoolCreated", 1),
                createMockEvent("Registry", "ProfileCreated", 2),
            ];

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");

            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce(mockEvents)
                .mockResolvedValue([]);
            eventsProcessorSpy.mockResolvedValue([]);
            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue({
                numFailed: 0,
                errors: [],
                changesets: [],
                numExecuted: 1,
                numSuccessful: 1,
            });
            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(
                () => {
                    if (eventsProcessorSpy.mock.calls.length < 2) throw new Error("Not yet called");
                },
                {
                    timeout: 1000,
                },
            );

            expect(eventsProcessorSpy).toHaveBeenCalledWith(mockEvents[0]);
            expect(eventsProcessorSpy).toHaveBeenCalledWith(mockEvents[1]);
            expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(mockEvents[0]);
            expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(mockEvents[1]);
        });

        it("wait and keep polling on empty queue", async () => {
            const getEventsAfterBlockNumberAndLogIndexSpy = vi.spyOn(
                mockIndexerClient,
                "getEventsAfterBlockNumberAndLogIndex",
            );
            getEventsAfterBlockNumberAndLogIndexSpy.mockResolvedValue([]);

            runPromise = orchestrator.run(abortController.signal);

            // Wait for a few polling cycles
            await new Promise((resolve) => setTimeout(resolve, mockFetchDelay * 3));

            expect(
                vi.spyOn(orchestrator["eventsProcessor"], "processEvent"),
            ).not.toHaveBeenCalled();
            expect(
                getEventsAfterBlockNumberAndLogIndexSpy.mock.calls.length,
            ).toBeGreaterThanOrEqual(3);
        });
    });

    describe("Strategy ID Enhancement", () => {
        it("adds strategy ID to Allo PoolCreated events", async () => {
            const strategyAddress = "0x123" as Address;
            const strategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf" as Hex;
            const mockEvent = createMockEvent("Allo", "PoolCreated", 1, {
                strategy: strategyAddress,
                poolId: 1n,
                profileId: "0x123",
                token: "0x123",
                amount: 100n,
                metadata: [1n, "1"],
            });

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");

            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);

            vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue(undefined);
            vi.spyOn(mockEvmProvider, "readContract").mockResolvedValue(strategyId);
            const changesets = [
                {
                    type: "InsertProject",
                    args: { chainId, projectId: "1", project: {} },
                } as unknown as Changeset,
                {
                    type: "InsertRoundRole",
                    args: { chainId, roundId: "1", roundRole: {} },
                } as unknown as Changeset,
                {
                    type: "DeletePendingRoundRoles",
                    args: { chainId, roundId: "1" },
                } as unknown as Changeset,
            ];

            eventsProcessorSpy.mockResolvedValue(changesets);

            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });

            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue({
                numFailed: 0,
                errors: [],
                changesets: ["InsertProject", "InsertRoundRole", "DeletePendingRoundRoles"],
                numExecuted: 3,
                numSuccessful: 3,
            });

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledTimes(1);
            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledWith(
                strategyAddress,
                strategyId,
            );
            expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledWith({
                ...mockEvent,
                strategyId,
            });
            expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledTimes(1);
            expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(changesets);
            expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(mockEvent);
        });

        const strategyEvents: Record<StrategyEvent, string> = {
            RegisteredWithSender: "",
            DistributedWithRecipientAddress: "",
            TimestampsUpdated: "",
            AllocatedWithToken: "",
            RegisteredWithData: "",
            DistributedWithData: "",
            DistributedWithFlowRate: "",
        };

        for (const event of Object.keys(strategyEvents) as StrategyEvent[]) {
            const strategyAddress = "0x123" as Address;
            const strategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf" as Hex;
            it(`adds strategy ID to Strategy ${event} events`, async () => {
                const mockEvent = createMockEvent("Strategy", event, 1, undefined, strategyAddress);
                const changesets = [
                    {
                        type: "InsertApplication",
                        args: { chainId, applicationId: "1", application: {} },
                    } as unknown as Changeset,
                ];

                const eventsProcessorSpy = vi.spyOn(
                    orchestrator["eventsProcessor"],
                    "processEvent",
                );

                vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
                vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                    .mockResolvedValueOnce([mockEvent])
                    .mockResolvedValue([]);

                vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue(strategyId);
                eventsProcessorSpy.mockResolvedValue(changesets);
                vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                    return Promise.resolve();
                });
                vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue({
                    numFailed: 0,
                    errors: [],
                    changesets: ["InsertApplication"],
                    numExecuted: 1,
                    numSuccessful: 1,
                });

                runPromise = orchestrator.run(abortController.signal);

                await vi.waitFor(() => {
                    if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
                });

                expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledTimes(1);
                expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledWith({
                    ...mockEvent,
                    strategyId,
                });
                expect(mockStrategyRegistry.getStrategyId).toHaveBeenCalledWith(strategyAddress);
                expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledTimes(1);
                expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(changesets);
                expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(mockEvent);
            });
        }

        it("discards events from unhandled strategies", async () => {
            const unhandledStrategyId = "0x6f9aaaaf02b266413f" as Hex;
            const strategyAddress = "0x123" as Address;
            const mockEvent = createMockEvent(
                "Strategy",
                "RegisteredWithSender",
                1,
                undefined,
                strategyAddress,
            );

            const getEventsAfterBlockNumberAndLogIndexSpy = vi.spyOn(
                mockIndexerClient,
                "getEventsAfterBlockNumberAndLogIndex",
            );
            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            getEventsAfterBlockNumberAndLogIndexSpy
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);

            vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue(unhandledStrategyId);
            vi.spyOn(mockEvmProvider, "readContract").mockResolvedValue(unhandledStrategyId);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (getEventsAfterBlockNumberAndLogIndexSpy.mock.calls.length >= 2)
                    throw new Error("Not yet called");
            });

            expect(orchestrator["eventsProcessor"].processEvent).not.toHaveBeenCalled();
            expect(orchestrator["dataLoader"].applyChanges).not.toHaveBeenCalled();
            expect(mockEventsRegistry.saveLastProcessedEvent).not.toHaveBeenCalled();
        });

        it("uses cached strategy ID from registry", async () => {
            const strategyAddress = "0x123" as Address;
            const strategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf" as Hex;
            const poolCreatedEvent = createMockEvent("Allo", "PoolCreated", 1, {
                strategy: strategyAddress,
                poolId: 1n,
                profileId: "0x123",
                token: "0x123",
                amount: 100n,
                metadata: [1n, "1"],
            });
            const registeredEvent = createMockEvent(
                "Strategy",
                "RegisteredWithSender",
                2,
                {
                    recipientId: "0x123",
                    data: "0x123",
                    sender: "0x123",
                },
                strategyAddress,
            );

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");

            vi.spyOn(mockStrategyRegistry, "getStrategyId")
                .mockResolvedValueOnce(undefined)
                .mockResolvedValue(strategyId);

            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([poolCreatedEvent])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([registeredEvent])
                .mockResolvedValue([]);

            eventsProcessorSpy.mockResolvedValue([]);
            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue({
                numFailed: 0,
                errors: [],
                changesets: [],
                numExecuted: 1,
                numSuccessful: 1,
            });
            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(
                () => {
                    if (eventsProcessorSpy.mock.calls.length < 2) throw new Error("Not yet called");
                },
                {
                    timeout: 1000,
                    interval: mockFetchDelay,
                },
            );

            expect(mockEvmProvider.readContract).toHaveBeenCalledTimes(1);
            expect(mockStrategyRegistry.getStrategyId).toHaveBeenLastCalledWith(strategyAddress);
            expect(eventsProcessorSpy).toHaveBeenLastCalledWith({
                ...registeredEvent,
                strategyId,
            });
        });

        it("does not add strategy ID to events from other strategies", async () => {
            const mockEvent = createMockEvent("Registry", "ProfileCreated", 1, undefined);
            const changesets = [
                {
                    type: "InsertPendingRoundRole",
                    args: { chainId, roundId: "1", roundRole: {} },
                } as unknown as Changeset,
            ];

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");

            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);

            eventsProcessorSpy.mockResolvedValue(changesets);

            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });

            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue({
                numFailed: 0,
                errors: [],
                changesets: ["InsertPendingRoundRole"],
                numExecuted: 1,
                numSuccessful: 1,
            });

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledTimes(1);
            expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledWith(mockEvent);
            expect(mockStrategyRegistry.getStrategyId).not.toHaveBeenCalled();
            expect(mockStrategyRegistry.saveStrategyId).not.toHaveBeenCalled();
        });
    });

    describe("Error Handling", () => {
        it.skip("retries error");

        it("keeps running when there is an error", async () => {
            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");
            const consoleSpy = vi.spyOn(console, "error");
            const errorEvent = createMockEvent("Allo", "Unknown" as unknown as AlloEvent, 1);
            const error = new Error("test");

            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([errorEvent])
                .mockResolvedValueOnce([createMockEvent("Registry", "ProfileCreated", 2)])
                .mockResolvedValue([]);

            eventsProcessorSpy.mockRejectedValueOnce(error).mockResolvedValueOnce([]);
            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue({
                numFailed: 0,
                errors: [],
                changesets: [],
                numExecuted: 1,
                numSuccessful: 1,
            });
            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(
                () => {
                    if (eventsProcessorSpy.mock.calls.length < 2) throw new Error("Not yet called");
                },
                {
                    timeout: 1000,
                },
            );

            expect(eventsProcessorSpy).toHaveBeenCalledTimes(2);
            expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledTimes(1);
            expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalledTimes(2);
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Error processing event: ${stringify(errorEvent)}`),
                error,
            );
        });

        it.skip("logs error for InvalidEvent", async () => {
            const mockEvent = createMockEvent("Allo", "Unknown" as unknown as AlloEvent, 1);
            const error = new InvalidEvent(mockEvent);

            const consoleSpy = vi.spyOn(console, "error");
            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");

            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);
            eventsProcessorSpy.mockRejectedValue(error);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("InvalidEvent"));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(stringify(mockEvent)));
            expect(orchestrator["dataLoader"].applyChanges).not.toHaveBeenCalled();
            expect(mockEventsRegistry.saveLastProcessedEvent).not.toHaveBeenCalled();
        });

        it.skip("logs error for UnsupportedEvent", async () => {
            const strategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf" as Hex;
            const mockEvent = createMockEvent(
                "Strategy",
                "NotHandled" as unknown as StrategyEvent,
                1,
            );
            const error = new UnsupportedStrategy(strategyId);

            vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue(strategyId);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);
            vi.spyOn(orchestrator["eventsProcessor"], "processEvent").mockRejectedValue(error);

            const consoleSpy = vi.spyOn(console, "error");

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (consoleSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Strategy ${strategyId} unsupported`),
            );
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(stringify(mockEvent)));
            expect(orchestrator["dataLoader"].applyChanges).not.toHaveBeenCalled();
            expect(mockEventsRegistry.saveLastProcessedEvent).not.toHaveBeenCalled();
        });

        it.skip("logs DataLoader errors", async () => {
            const mockEvent = createMockEvent("Allo", "PoolCreated", 1);
            const mockChangesets: Changeset[] = [
                { type: "UpdateProject", args: { chainId, projectId: "1", project: {} } },
            ];

            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");

            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);
            vi.spyOn(orchestrator["eventsProcessor"], "processEvent").mockResolvedValue(
                mockChangesets,
            );
            dataLoaderSpy.mockResolvedValue({
                numFailed: 1,
                errors: ["Failed to update project"],
                changesets: ["UpdateProject"],
                numExecuted: 1,
                numSuccessful: 0,
            });

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (dataLoaderSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("Failed to apply changesets"),
            );
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(stringify(mockEvent)));
            expect(dataLoaderSpy).toHaveBeenCalledTimes(1);
            expect(mockEventsRegistry.saveLastProcessedEvent).not.toHaveBeenCalled();
        });
    });
});

// Helper function to create mock events
function createMockEvent<T extends ContractName, E extends ContractToEventName<T>>(
    contractName: T,
    eventName: E,
    blockNumber: number,
    params: EventParams<T, E> = {} as EventParams<T, E>,
    srcAddress: Address = "0x123" as Address,
): ProcessorEvent<T, E> {
    return {
        contractName,
        eventName,
        blockNumber,
        blockTimestamp: 1234567890,
        chainId: 1 as ChainId,
        logIndex: 0,
        srcAddress,
        params,
        transactionFields: {
            hash: "0xabc",
            transactionIndex: 0,
        },
    } as ProcessorEvent<T, E>;
}
