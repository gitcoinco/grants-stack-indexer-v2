import { Address, zeroAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    Changeset,
    IApplicationPayoutRepository,
    IApplicationRepository,
    IAttestationRepository,
    IDonationRepository,
    IEventRegistryRepository,
    IProjectRepository,
    IRoundRepository,
    ITransactionManager,
    RoundNotFound,
    RoundNotFoundForId,
} from "@grants-stack-indexer/repository";
import {
    AlloEvent,
    AnyIndexerFetchedEvent,
    ChainId,
    ContractName,
    ContractToEventName,
    EventParams,
    ExponentialBackoff,
    Hex,
    ICacheable,
    ILogger,
    INotifier,
    ProcessorEvent,
    RateLimitError,
    StrategyEvent,
    TimestampMs,
} from "@grants-stack-indexer/shared";

import { CoreDependencies, InvalidEvent, IStrategyRegistry } from "../../src/internal.js";
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
    let mockStrategyRegistry: IStrategyRegistry;
    let mockEventsRegistry: IEventRegistryRepository;
    let mockPricingProvider: IPricingProvider & ICacheable;
    let mockMetadataProvider: IMetadataProvider & ICacheable;
    let mockEvmProvider: EvmProvider;
    let abortController: AbortController;
    let runPromise: Promise<void> | undefined;

    const chainId = 1 as ChainId;
    const mockFetchLimit = 10;
    const mockFetchDelay = 100;
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    const notifier: INotifier = {
        send: vi.fn(),
    };

    beforeEach(() => {
        // Setup mock implementations
        mockIndexerClient = {
            getEventsAfterBlockNumberAndLogIndex: vi.fn(),
        } as unknown as IIndexerClient;

        mockEventsRegistry = {
            getLastProcessedEvent: vi.fn(),
            saveLastProcessedEvent: vi.fn(),
        } as unknown as IEventRegistryRepository;

        mockStrategyRegistry = {
            getStrategyId: vi.fn(),
            saveStrategyId: vi.fn(),
            getStrategies: vi.fn(),
        };

        mockEvmProvider = {
            readContract: vi.fn(),
        } as unknown as EvmProvider;

        mockPricingProvider = {
            getTokenPrice: vi.fn(),
            getTokenPrices: vi.fn(),
            clearCache: vi.fn(),
        };

        mockMetadataProvider = {
            getMetadata: vi.fn(),
            clearCache: vi.fn(),
        };

        const dependencies: CoreDependencies = {
            evmProvider: mockEvmProvider,
            transactionManager: {} as unknown as ITransactionManager,
            projectRepository: {} as unknown as IProjectRepository,
            roundRepository: {} as unknown as IRoundRepository,
            applicationRepository: {} as unknown as IApplicationRepository,
            donationRepository: {} as unknown as IDonationRepository,
            applicationPayoutRepository: {} as unknown as IApplicationPayoutRepository,
            attestationRepository: {} as unknown as IAttestationRepository,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
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
            new ExponentialBackoff({ baseDelay: 10, maxAttempts: 3, factor: 2 }),
            logger,
            notifier,
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
            vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue({
                id: "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf",
                address: "0x123",
                chainId,
                handled: false,
            });
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce(mockEvents)
                .mockResolvedValue([]);
            eventsProcessorSpy.mockResolvedValue([]);
            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue(
                await Promise.resolve(),
            );

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
            expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledTimes(2);
            expect(mockEventsRegistry.saveLastProcessedEvent).not.toHaveBeenCalled();
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

        it("includes InsertProcessedEvent changeset in transaction", async () => {
            const mockEvent = createMockEvent("Registry", "ProfileCreated", 1);
            const changesets = [
                {
                    type: "InsertProject",
                    args: { chainId, projectId: "1", project: {} },
                } as unknown as Changeset,
            ];

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");
            const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");

            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);

            eventsProcessorSpy.mockResolvedValue(changesets);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(dataLoaderSpy).toHaveBeenCalledWith([
                ...changesets,
                {
                    type: "InsertProcessedEvent",
                    args: {
                        chainId,
                        processedEvent: {
                            ...mockEvent,
                            rawEvent: mockEvent,
                        },
                    },
                },
            ]);
            expect(mockEventsRegistry.saveLastProcessedEvent).not.toHaveBeenCalled();
        });

        it("saves event outside transaction when processing fails", async () => {
            const mockEvent = createMockEvent("Registry", "ProfileCreated", 1);
            const error = new Error("Processing failed");

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");
            const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");

            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);

            eventsProcessorSpy.mockRejectedValue(error);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(dataLoaderSpy).not.toHaveBeenCalled();
            expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(chainId, {
                ...mockEvent,
                rawEvent: mockEvent,
            });
        });

        it("rolls back transaction on error", async () => {
            const mockEvent = createMockEvent("Registry", "ProfileCreated", 1);
            const changesets = [
                {
                    type: "InsertProject",
                    args: { chainId, projectId: "1", project: {} },
                } as unknown as Changeset,
            ];
            const error = new Error("Transaction failed");

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");
            const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");

            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);

            eventsProcessorSpy.mockResolvedValue(changesets);
            dataLoaderSpy.mockRejectedValue(error);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(dataLoaderSpy).toHaveBeenCalled();
            expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(chainId, {
                ...mockEvent,
                rawEvent: mockEvent,
            });
        });
    });

    describe("Strategy ID Enhancement", () => {
        it("adds strategy ID to Allo PoolCreated events", async () => {
            const strategyAddress = "0x123" as Address;
            const strategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf" as Hex;
            const mockEvent = createMockEvent("Allo", "PoolCreated", 1, {
                strategy: strategyAddress,
                poolId: "1",
                profileId: "0x123",
                token: "0x123",
                amount: "100",
                metadata: ["1", "1"],
            });

            // make private method bulkFetchMetadataAndPricesForBatch return undefined
            orchestrator["bulkFetchMetadataAndPricesForBatch"] = vi
                .fn()
                .mockResolvedValue(undefined);
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

            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue(
                await Promise.resolve(),
            );

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledTimes(1);
            expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledWith({
                ...mockEvent,
                strategyId,
            });
            expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledTimes(1);
            expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
                expect.arrayContaining(changesets),
            );
        });

        it("save strategyId to registry on PoolCreated event", async () => {
            const strategyAddress = "0xff212432" as Address;
            const strategyId = "0xunknown" as Hex;
            const existingStrategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf" as Hex;

            const mockEvent = createMockEvent("Allo", "PoolCreated", 1, {
                strategy: strategyAddress,
                poolId: "1",
                profileId: "0x123",
                token: "0x123",
                amount: "100",
                metadata: ["1", "1"],
            });

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");
            orchestrator["bulkFetchMetadataAndPricesForBatch"] = vi
                .fn()
                .mockResolvedValue(undefined);
            vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue(undefined);
            vi.spyOn(mockEvmProvider, "readContract")
                .mockResolvedValueOnce(strategyId)
                .mockResolvedValueOnce(existingStrategyId);
            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent, mockEvent])
                .mockResolvedValue([]);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenNthCalledWith(
                1,
                chainId,
                mockEvent.params.strategy,
                strategyId,
                false,
            );
            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenNthCalledWith(
                2,
                chainId,
                mockEvent.params.strategy,
                existingStrategyId,
                true,
            );
        });

        const strategyEvents: Record<StrategyEvent, string> = {
            RegisteredWithSender: "",
            DistributedWithRecipientAddress: "",
            TimestampsUpdated: "",
            AllocatedWithToken: "",
            RegisteredWithData: "",
            DistributedWithData: "",
            DistributedWithFlowRate: "",
            AllocatedWithOrigin: "",
            AllocatedWithData: "",
            AllocatedWithVotes: "",
            AllocatedWithStatus: "",
            TimestampsUpdatedWithRegistrationAndAllocation: "",
            DistributionUpdated: "",
            FundsDistributed: "",
            RecipientStatusUpdatedWithApplicationId: "",
            RecipientStatusUpdatedWithRecipientStatus: "",
            RecipientStatusUpdatedWithFullRow: "",
            UpdatedRegistrationWithStatus: "",
            UpdatedRegistration: "",
            UpdatedRegistrationWithApplicationId: "",
            DirectAllocated: "",
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

                vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue({
                    id: strategyId,
                    address: strategyAddress,
                    chainId,
                    handled: true,
                });
                eventsProcessorSpy.mockResolvedValue(changesets);
                vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                    return Promise.resolve();
                });
                vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue(
                    await Promise.resolve(),
                );

                runPromise = orchestrator.run(abortController.signal);

                await vi.waitFor(() => {
                    if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
                });

                expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledTimes(1);
                expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledWith({
                    ...mockEvent,
                    strategyId,
                });
                expect(mockStrategyRegistry.getStrategyId).toHaveBeenCalledWith(
                    chainId,
                    strategyAddress,
                );
                expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledTimes(1);
                expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith([
                    ...changesets,
                    {
                        type: "InsertProcessedEvent",
                        args: {
                            chainId,
                            processedEvent: {
                                ...mockEvent,
                                rawEvent: mockEvent,
                            },
                        },
                    },
                ]);
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
            const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");

            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);

            vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue({
                id: unhandledStrategyId,
                address: strategyAddress,
                chainId,
                handled: false,
            });
            vi.spyOn(mockEvmProvider, "readContract").mockResolvedValue(unhandledStrategyId);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (getEventsAfterBlockNumberAndLogIndexSpy.mock.calls.length < 1)
                    throw new Error("Not yet called");
            });

            expect(orchestrator["eventsProcessor"].processEvent).not.toHaveBeenCalled();
            expect(dataLoaderSpy).toHaveBeenCalledWith([
                {
                    type: "InsertProcessedEvent",
                    args: {
                        chainId,
                        processedEvent: {
                            ...mockEvent,
                            rawEvent: mockEvent,
                            strategyId: unhandledStrategyId,
                        },
                    },
                },
            ]);
            expect(mockEventsRegistry.saveLastProcessedEvent).not.toHaveBeenCalled();
            expect(mockStrategyRegistry.saveStrategyId).not.toHaveBeenCalled();
        });

        it("uses cached strategy ID from registry", async () => {
            const strategyAddress = "0x123" as Address;
            const strategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf" as Hex;
            const poolCreatedEvent = createMockEvent("Allo", "PoolCreated", 1, {
                strategy: strategyAddress,
                poolId: "1",
                profileId: "0x123",
                token: "0x123",
                amount: "100",
                metadata: ["1", "1"],
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

            orchestrator["bulkFetchMetadataAndPricesForBatch"] = vi
                .fn()
                .mockResolvedValue(undefined);
            vi.spyOn(mockStrategyRegistry, "getStrategyId")
                .mockResolvedValueOnce(undefined)
                .mockResolvedValue({
                    id: strategyId,
                    address: strategyAddress,
                    chainId,
                    handled: true,
                });
            vi.spyOn(mockEvmProvider, "readContract").mockResolvedValue(strategyId);

            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([poolCreatedEvent, registeredEvent])
                .mockResolvedValue([]);

            eventsProcessorSpy.mockResolvedValue([]);
            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue(
                await Promise.resolve(),
            );
            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });
            vi.spyOn(mockStrategyRegistry, "saveStrategyId").mockImplementation(() => {
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
            expect(mockStrategyRegistry.getStrategyId).toHaveBeenLastCalledWith(
                chainId,
                strategyAddress,
            );
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

            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue(
                await Promise.resolve(),
            );

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
        it("retries retriable errors", async () => {
            const retriableError = new RateLimitError({ className: "ExternalProvider" }, 10);
            const mockEvent = createMockEvent("Allo", "Unknown" as unknown as AlloEvent, 1);

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");

            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);
            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue(
                await Promise.resolve(),
            );
            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });
            eventsProcessorSpy.mockRejectedValueOnce(retriableError).mockResolvedValueOnce([]);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 2) throw new Error("Not yet called");
            });

            expect(eventsProcessorSpy).toHaveBeenCalledTimes(2);
            expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledTimes(1);
        });

        it("keeps running when there is an error", async () => {
            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");
            const errorEvent = createMockEvent("Allo", "Unknown" as unknown as AlloEvent, 1);
            const error = new Error("test");

            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([errorEvent])
                .mockResolvedValueOnce([createMockEvent("Registry", "ProfileCreated", 2)])
                .mockResolvedValue([]);

            eventsProcessorSpy.mockRejectedValueOnce(error).mockResolvedValueOnce([]);
            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue(
                await Promise.resolve(),
            );
            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(
                () => {
                    if (eventsProcessorSpy.mock.calls.length < 2) throw new Error("Not yet called");
                },
                {
                    timeout: 2000,
                },
            );

            expect(eventsProcessorSpy).toHaveBeenCalledTimes(2);
            expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledTimes(1);
            expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(error, {
                className: Orchestrator.name,
                chainId,
                event: errorEvent,
            });
        });

        it("logs debug for InvalidEvent", async () => {
            const mockEvent = createMockEvent("Allo", "Unknown" as unknown as AlloEvent, 1);
            const error = new InvalidEvent(mockEvent);

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");

            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);
            eventsProcessorSpy.mockRejectedValue(error);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(logger.debug).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining(
                    `Current event cannot be handled. ${error.name}: ${error.message}.`,
                ),
                {
                    className: Orchestrator.name,
                    chainId,
                    event: mockEvent,
                },
            );
            expect(orchestrator["dataLoader"].applyChanges).not.toHaveBeenCalled();
            expect(mockEventsRegistry.saveLastProcessedEvent).toHaveBeenCalled();
        });

        it("logs DataLoader errors", async () => {
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

            const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
            const error = new Error("Failed to apply changesets");
            dataLoaderSpy.mockRejectedValue(error);

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 1) throw new Error("Not yet called");
            });

            expect(logger.error).toHaveBeenCalledWith(error, {
                event: mockEvent,
                className: Orchestrator.name,
                chainId,
            });
            expect(dataLoaderSpy).toHaveBeenCalledTimes(1);
        });

        it("ignores TimestampsUpdated errors if PoolCreated is in the same block", async () => {
            const strategyAddress = "0x123" as Address;
            const strategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf" as Hex;
            const timestampsUpdatedEvent = createMockEvent("Strategy", "TimestampsUpdated", 1);
            timestampsUpdatedEvent.logIndex = 0;
            const timestampUpdatedEvent2 = createMockEvent(
                "Strategy",
                "TimestampsUpdatedWithRegistrationAndAllocation",
                1,
            );
            timestampUpdatedEvent2.logIndex = 1;
            const poolCreatedEvent = createMockEvent("Allo", "PoolCreated", 1, {
                strategy: strategyAddress,
                poolId: "1",
                profileId: "0x123",
                token: "0x123",
                amount: "100",
                metadata: ["1", "1"],
            });
            poolCreatedEvent.logIndex = 3;

            const eventsProcessorSpy = vi.spyOn(orchestrator["eventsProcessor"], "processEvent");
            orchestrator["bulkFetchMetadataAndPricesForBatch"] = vi
                .fn()
                .mockResolvedValue(undefined);
            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue(undefined);
            vi.spyOn(mockIndexerClient, "getEventsAfterBlockNumberAndLogIndex")
                .mockResolvedValueOnce([
                    timestampsUpdatedEvent,
                    timestampUpdatedEvent2,
                    poolCreatedEvent,
                ])
                .mockResolvedValue([]);

            vi.spyOn(mockStrategyRegistry, "getStrategyId").mockResolvedValue(undefined);
            vi.spyOn(mockEvmProvider, "readContract").mockResolvedValue(strategyId);

            eventsProcessorSpy
                .mockRejectedValueOnce(new RoundNotFound(chainId, strategyAddress))
                .mockRejectedValueOnce(new RoundNotFoundForId(chainId, "1"))
                .mockResolvedValueOnce([]);

            vi.spyOn(mockEventsRegistry, "saveLastProcessedEvent").mockImplementation(() => {
                return Promise.resolve();
            });

            vi.spyOn(orchestrator["dataLoader"], "applyChanges").mockResolvedValue(
                await Promise.resolve(),
            );

            runPromise = orchestrator.run(abortController.signal);

            await vi.waitFor(() => {
                if (eventsProcessorSpy.mock.calls.length < 3) throw new Error("Not yet called");
            });

            expect(orchestrator["eventsProcessor"].processEvent).toHaveBeenCalledTimes(3);
            expect(logger.error).not.toHaveBeenCalled();
        });
    });

    describe("bulkFetchMetadataAndPricesForBatch", () => {
        it("clears cache and fetches metadata and prices in parallel", async () => {
            const events = [
                {
                    params: {
                        metadata: ["type", "id1"],
                        token: zeroAddress,
                        amount: "1000000000000000000",
                    },
                    blockTimestamp: 1000,
                },
            ] as unknown as AnyIndexerFetchedEvent[];

            vi.spyOn(mockPricingProvider, "getTokenPrices").mockResolvedValue([
                { timestampMs: 1000 as TimestampMs, priceUsd: 1500 },
            ]);

            vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue({ name: "Test" });

            await orchestrator["bulkFetchMetadataAndPricesForBatch"](events);

            expect(mockMetadataProvider.clearCache).toHaveBeenCalled();
            expect(mockMetadataProvider.getMetadata).toHaveBeenCalledWith("id1");
            expect(mockPricingProvider.getTokenPrices).toHaveBeenCalledWith("ETH", [1000]);
        });

        it("continues processing even if one fetch fails", async () => {
            const events = [
                {
                    params: {
                        metadata: ["type", "id1"],
                        token: "0x123",
                        amount: "1000000000000000000",
                    },
                    blockTimestamp: 1000,
                },
            ] as unknown as AnyIndexerFetchedEvent[];

            orchestrator["bulkFetchMetadataAndPricesForBatch"] = vi
                .fn()
                .mockResolvedValue(undefined);
            vi.spyOn(mockMetadataProvider, "getMetadata").mockRejectedValue(
                new Error("Fetch failed"),
            );
            vi.spyOn(mockPricingProvider, "getTokenPrices").mockResolvedValue([]);

            // Should not throw
            await expect(
                orchestrator["bulkFetchMetadataAndPricesForBatch"](events),
            ).resolves.not.toThrow();
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
