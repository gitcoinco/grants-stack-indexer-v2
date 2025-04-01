import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import {
    IApplicationPayoutRepository,
    IApplicationRepository,
    IAttestationRepository,
    IDonationRepository,
    ILegacyProjectRepository,
    IProjectRepository,
    IRoundRepository,
    IStrategyProcessingCheckpointRepository,
    ITransactionManager,
    Strategy,
} from "@grants-stack-indexer/repository";
import {
    ChainId,
    ContractToEventName,
    DeepPartial,
    EventParams,
    ExponentialBackoff,
    Hex,
    ILogger,
    mergeDeep,
    ProcessorEvent,
    RateLimitError,
    TimestampMs,
} from "@grants-stack-indexer/shared";

import {
    CoreDependencies,
    DataLoader,
    EventsProcessor,
    IEventsFetcher,
    IEventsRegistry,
    InvalidEvent,
    IStrategyRegistry,
} from "../../src/internal.js";
import { RetroactiveProcessor } from "../../src/retroactiveProcessor.js";

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

vi.mock("../../src/eventsFetcher.js", () => {
    const EventsFetcher = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    EventsFetcher.prototype.fetchEvents = vi.fn();
    return {
        EventsFetcher,
    };
});

describe("RetroactiveProcessor", () => {
    let processor: RetroactiveProcessor;
    let mockIndexerClient: IIndexerClient;
    let mockEventsRegistry: IEventsRegistry;
    let mockStrategyRegistry: IStrategyRegistry;
    let mockEvmProvider: EvmProvider;
    let mockCheckpointRepository: IStrategyProcessingCheckpointRepository;
    let mockLogger: ILogger;
    let mockEventsProcessor: EventsProcessor;
    let mockDataLoader: DataLoader;
    let mockEventsFetcher: IEventsFetcher;

    const chainId = 1 as ChainId;
    const mockFetchLimit = 10;
    const existentStrategyId =
        "0x103732a8e473467a510d4128ee11065262bdd978f0d9dad89ba68f2c56127e27" as Hex;
    const eventName = "TimestampsUpdated";
    const defaultParams = {
        startTime: "1704067200", // 2024-01-01 00:00:00
        endTime: "1704153600", // 2024-01-02 00:00:00
        sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
    } as const;

    const mockValidStrategies: Strategy[] = [
        {
            address: "0x1234",
            id: existentStrategyId,
            chainId,
            handled: false,
        },
        {
            address: "0x4567",
            id: existentStrategyId,
            chainId,
            handled: false,
        },
    ];

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
            getStrategies: vi.fn(),
        };

        mockEvmProvider = {
            readContract: vi.fn(),
        } as unknown as EvmProvider;

        mockLogger = {
            debug: vi.fn(),
            verbose: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        };

        mockCheckpointRepository = {
            upsertCheckpoint: vi.fn(),
            deleteCheckpoint: vi.fn(),
            getCheckpoint: vi.fn(),
        };

        const dependencies: CoreDependencies = {
            evmProvider: mockEvmProvider,
            projectRepository: {} as IProjectRepository,
            roundRepository: {} as IRoundRepository,
            applicationRepository: {} as IApplicationRepository,
            donationRepository: {} as IDonationRepository,
            applicationPayoutRepository: {} as IApplicationPayoutRepository,
            attestationRepository: {} as IAttestationRepository,
            legacyProjectRepository: {} as ILegacyProjectRepository,
            transactionManager: {} as ITransactionManager,
            pricingProvider: {
                getTokenPrice: vi.fn(),
                getTokenPrices: vi.fn(),
            },
            metadataProvider: {
                getMetadata: vi.fn(),
            },
        };

        processor = new RetroactiveProcessor(
            chainId,
            dependencies,
            mockIndexerClient,
            {
                eventsRegistry: mockEventsRegistry,
                strategyRegistry: mockStrategyRegistry,
                checkpointRepository: mockCheckpointRepository,
            },
            mockFetchLimit,
            new ExponentialBackoff({ baseDelay: 100, maxAttempts: 3, factor: 2 }),
            mockLogger,
        );

        mockEventsProcessor = processor["eventsProcessor"];
        mockDataLoader = processor["dataLoader"];
        mockEventsFetcher = processor["eventsFetcher"];
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("processRetroactiveStrategies", () => {
        it("exits early if all strategies are marked as handled", async () => {
            vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue([]);

            await processor.processRetroactiveStrategies();

            expect(mockLogger.info).toHaveBeenCalledWith("No new handleable strategies found", {
                className: RetroactiveProcessor.name,
                chainId,
            });
            expect(mockEventsRegistry.getLastProcessedEvent).not.toHaveBeenCalled();
        });

        it("exits early if Handler doesn't exist for strategy", async () => {
            const mockStrategy: Strategy = {
                address: "0x1234",
                id: "0xnohandler",
                chainId,
                handled: false,
            };
            vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue([mockStrategy]);

            await processor.processRetroactiveStrategies();

            expect(mockLogger.info).toHaveBeenCalledWith("No new handleable strategies found", {
                className: RetroactiveProcessor.name,
                chainId,
            });
            expect(mockEventsRegistry.getLastProcessedEvent).not.toHaveBeenCalled();
        });

        it("process new handleable strategies", async () => {
            const mockEvent = createMockEvent(eventName, defaultParams, existentStrategyId, {
                blockNumber: 90,
                logIndex: 0,
            });

            vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue(mockValidStrategies);
            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue({
                blockNumber: 100,
                logIndex: 1,
                chainId,
                blockTimestamp: 1234567890,
            });
            vi.spyOn(processor["eventsFetcher"], "fetchEvents")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);
            vi.spyOn(mockEventsProcessor, "processEvent").mockResolvedValue([]);
            vi.spyOn(mockDataLoader, "applyChanges").mockResolvedValue(await Promise.resolve());
            vi.spyOn(mockStrategyRegistry, "saveStrategyId").mockResolvedValue();

            await processor.processRetroactiveStrategies();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Retroactive processing complete. Succeeded: 1, Failed: 0",
                {
                    className: RetroactiveProcessor.name,
                    chainId,
                },
            );
            expect(mockEventsProcessor.processEvent).toHaveBeenCalledTimes(1);
            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledTimes(2);
            expect(mockCheckpointRepository.upsertCheckpoint).toHaveBeenCalledTimes(1);
            expect(mockCheckpointRepository.deleteCheckpoint).toHaveBeenCalledTimes(1);
        });

        it("process multiple new handleable strategies", async () => {
            const strategies: Strategy[] = [
                ...mockValidStrategies,
                {
                    address: "0x9abc",
                    id: "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf",
                    chainId,
                    handled: false,
                },
            ];
            const mockEvent = createMockEvent(eventName, defaultParams, existentStrategyId, {
                blockNumber: 50,
                logIndex: 0,
            });

            vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue(strategies);
            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue({
                blockNumber: 100,
                logIndex: 1,
                chainId,
                blockTimestamp: 1234567890,
            });

            const fetchEventsSpy = vi.spyOn(mockEventsFetcher, "fetchEvents");
            fetchEventsSpy.mockImplementation(async (params) => {
                if (params.from?.blockNumber === 0 && params.from?.logIndex === 0) {
                    return [mockEvent];
                }
                return [];
            });
            vi.spyOn(mockEventsProcessor, "processEvent").mockResolvedValue([]);
            vi.spyOn(mockDataLoader, "applyChanges").mockResolvedValue(await Promise.resolve());
            vi.spyOn(mockStrategyRegistry, "saveStrategyId").mockResolvedValue();

            await processor.processRetroactiveStrategies();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Retroactive processing complete. Succeeded: 2, Failed: 0",
                {
                    className: RetroactiveProcessor.name,
                    chainId,
                },
            );
            expect(mockEventsFetcher.fetchEvents).toHaveBeenCalledTimes(4);
            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledTimes(3);
            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledWith(
                chainId,
                "0x9abc",
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf",
                true,
            );
            expect(mockCheckpointRepository.upsertCheckpoint).toHaveBeenCalledTimes(2);
            expect(mockCheckpointRepository.deleteCheckpoint).toHaveBeenCalledTimes(2);
        });

        it("starts from checkpoint if exists", async () => {
            const mockEvent = createMockEvent(eventName, defaultParams, existentStrategyId, {
                blockNumber: 95,
                logIndex: 4,
            });

            vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue(mockValidStrategies);
            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue({
                blockNumber: 100,
                logIndex: 1,
                chainId,
                blockTimestamp: 1234567890,
            });
            vi.spyOn(mockCheckpointRepository, "getCheckpoint").mockResolvedValue({
                chainId,
                strategyId: existentStrategyId,
                lastProcessedBlockNumber: 90,
                lastProcessedLogIndex: 0,
            });

            vi.spyOn(mockEventsFetcher, "fetchEvents")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValue([]);
            vi.spyOn(mockEventsProcessor, "processEvent").mockResolvedValue([]);
            vi.spyOn(mockDataLoader, "applyChanges").mockResolvedValue(await Promise.resolve());
            vi.spyOn(mockStrategyRegistry, "saveStrategyId").mockResolvedValue();

            await processor.processRetroactiveStrategies();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Retroactive processing complete. Succeeded: 1, Failed: 0",
                {
                    className: RetroactiveProcessor.name,
                    chainId,
                },
            );

            expect(mockEventsProcessor.processEvent).toHaveBeenCalledTimes(1);
            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledTimes(2);
            expect(mockEventsFetcher.fetchEvents).not.toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    from: { blockNumber: 0, logIndex: 0 },
                }),
            );
            expect(mockCheckpointRepository.upsertCheckpoint).toHaveBeenCalledTimes(1);
            expect(mockCheckpointRepository.deleteCheckpoint).toHaveBeenCalledTimes(1);
        });

        it("breaks loop if event is older than last processed", async () => {
            const mockEvent = createMockEvent(eventName, defaultParams, existentStrategyId, {
                blockNumber: 100,
                logIndex: 2,
            });

            vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue(mockValidStrategies);
            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue({
                blockNumber: 100,
                logIndex: 1,
                chainId,
                blockTimestamp: 1234567890,
            });
            vi.spyOn(processor["eventsFetcher"], "fetchEvents").mockResolvedValueOnce([mockEvent]);

            vi.spyOn(mockEventsProcessor, "processEvent").mockResolvedValue([]);
            vi.spyOn(mockDataLoader, "applyChanges").mockResolvedValue(await Promise.resolve());
            vi.spyOn(mockStrategyRegistry, "saveStrategyId").mockResolvedValue();

            await processor.processRetroactiveStrategies();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Retroactive processing complete. Succeeded: 1, Failed: 0",
                {
                    className: RetroactiveProcessor.name,
                    chainId,
                },
            );
            expect(mockEventsProcessor.processEvent).toHaveBeenCalledTimes(0);
            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledTimes(2);
        });

        it("keep fetching events if available", async () => {
            const mockEvent = createMockEvent(eventName, defaultParams, existentStrategyId, {
                blockNumber: 90,
                logIndex: 0,
            });
            const mockEvent2 = createMockEvent(eventName, defaultParams, existentStrategyId, {
                blockNumber: 95,
                logIndex: 4,
            });

            vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue(mockValidStrategies);
            vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue({
                blockNumber: 100,
                logIndex: 1,
                chainId,
                blockTimestamp: 1234567890,
            });
            vi.spyOn(processor["eventsFetcher"], "fetchEvents")
                .mockResolvedValueOnce([mockEvent])
                .mockResolvedValueOnce([mockEvent2])
                .mockResolvedValue([]);

            vi.spyOn(mockEventsProcessor, "processEvent").mockResolvedValue([]);
            vi.spyOn(mockDataLoader, "applyChanges").mockResolvedValue(await Promise.resolve());
            vi.spyOn(mockStrategyRegistry, "saveStrategyId").mockResolvedValue();

            await processor.processRetroactiveStrategies();

            expect(mockEventsProcessor.processEvent).toHaveBeenCalledTimes(2);
            expect(mockEventsFetcher.fetchEvents).toHaveBeenCalledTimes(3);
            expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledTimes(2);
        });

        describe("error handling", () => {
            it("handles expected errors silently and continues processing", async () => {
                const mockEvent1 = createMockEvent(eventName, defaultParams, existentStrategyId, {
                    blockNumber: 50,
                    logIndex: 0,
                });
                const mockEvent2 = createMockEvent(eventName, defaultParams, existentStrategyId, {
                    blockNumber: 60,
                    logIndex: 0,
                });

                vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue(
                    mockValidStrategies,
                );
                vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue({
                    blockNumber: 100,
                    logIndex: 1,
                    chainId,
                    blockTimestamp: 1234567890,
                });

                // First event throws InvalidEvent, second one processes successfully
                vi.spyOn(mockEventsFetcher, "fetchEvents")
                    .mockResolvedValueOnce([mockEvent1, mockEvent2])
                    .mockResolvedValue([]);

                const processEventSpy = vi.spyOn(mockEventsProcessor, "processEvent");
                processEventSpy
                    .mockRejectedValueOnce(new InvalidEvent(mockEvent1))
                    .mockResolvedValueOnce([]);

                vi.spyOn(mockDataLoader, "applyChanges").mockResolvedValue(await Promise.resolve());

                await processor.processRetroactiveStrategies();

                // Verify that processing continued after the error
                expect(processEventSpy).toHaveBeenCalledTimes(2);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining("Skipping error for InvalidEvent"),
                    {
                        className: RetroactiveProcessor.name,
                        chainId,
                    },
                );
                expect(mockLogger.error).not.toHaveBeenCalled();
                expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledTimes(2);
            });

            it("handles error on marking strategy as handled", async () => {
                const unexpectedError = new Error("Unexpected database error");
                const mockEvent = createMockEvent(eventName, defaultParams, existentStrategyId, {
                    blockNumber: 50,
                    logIndex: 0,
                });

                vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue(
                    mockValidStrategies,
                );
                vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue({
                    blockNumber: 100,
                    logIndex: 1,
                    chainId,
                    blockTimestamp: 1234567890,
                });

                vi.spyOn(mockEventsFetcher, "fetchEvents")
                    .mockResolvedValueOnce([mockEvent])
                    .mockResolvedValue([]);

                vi.spyOn(mockEventsProcessor, "processEvent").mockRejectedValue(unexpectedError);
                vi.spyOn(mockStrategyRegistry, "saveStrategyId")
                    .mockResolvedValueOnce()
                    .mockRejectedValue(unexpectedError);

                await processor.processRetroactiveStrategies();

                expect(mockLogger.info).toHaveBeenCalledWith(
                    "Retroactive processing complete. Succeeded: 0, Failed: 1",
                    {
                        className: RetroactiveProcessor.name,
                        chainId,
                    },
                );
            });

            it("retries on retriable errors", async () => {
                const retriableError = new RateLimitError({ className: "ExternalProvider" }, 100);
                vi.spyOn(mockEventsProcessor, "processEvent").mockRejectedValueOnce(retriableError);

                const mockEvent = createMockEvent(eventName, defaultParams, existentStrategyId, {
                    blockNumber: 50,
                    logIndex: 0,
                });

                vi.spyOn(mockStrategyRegistry, "getStrategies").mockResolvedValue(
                    mockValidStrategies,
                );
                vi.spyOn(mockEventsRegistry, "getLastProcessedEvent").mockResolvedValue({
                    blockNumber: 100,
                    logIndex: 1,
                    chainId,
                    blockTimestamp: 1234567890,
                });

                vi.spyOn(mockEventsFetcher, "fetchEvents")
                    .mockResolvedValueOnce([mockEvent])
                    .mockResolvedValue([]);

                const processEventSpy = vi.spyOn(mockEventsProcessor, "processEvent");
                processEventSpy.mockRejectedValueOnce(retriableError).mockResolvedValue([]);

                vi.spyOn(mockDataLoader, "applyChanges").mockResolvedValue(await Promise.resolve());

                await processor.processRetroactiveStrategies();

                expect(processEventSpy).toHaveBeenCalledTimes(2); // 1st attempt failed, 2nd attempt succeeded
                expect(mockLogger.error).not.toHaveBeenCalled();
                expect(mockDataLoader.applyChanges).toHaveBeenCalledTimes(1);
            });
        });
    });
});
/**
 * Creates a mock event for testing.
 *
 * @param eventName - The name of the event.
 * @param params - The parameters of the event.
 * @param strategyId - The ID of the strategy.
 * @param overrides - The overrides for the event.
 * @returns A mock event.
 *
 * @default
 *      srcAddress: "0x1234567890123456789012345678901234567890",
 *      blockNumber: 118034410,
 *      blockTimestamp: 1000000000,
 *      chainId: 10 as ChainId,
 *      contractName: "Strategy",
 *      logIndex: 1,
 *      transactionFields: {
 *          hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
 *          transactionIndex: 1,
 *          from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
 *      },
 */
export const createMockEvent = <T extends ContractToEventName<"Strategy">>(
    eventName: T,
    params: EventParams<"Strategy", T>,
    strategyId: Hex,
    overrides: DeepPartial<ProcessorEvent<"Strategy", T>> = {},
): ProcessorEvent<"Strategy", T> => {
    const defaultEvent: ProcessorEvent<"Strategy", T> = {
        eventName,
        params,
        srcAddress: "0x1234567890123456789012345678901234567890",
        blockNumber: 118034410,
        blockTimestamp: 1704067241331 as TimestampMs,
        chainId: 10 as ChainId,
        contractName: "Strategy",
        logIndex: 1,
        transactionFields: {
            hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
            transactionIndex: 1,
            from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        strategyId,
    };

    return mergeDeep(defaultEvent, overrides);
};
