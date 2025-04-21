import * as fs from "fs";
import * as path from "path";
import { isNativeError } from "util/types";
import pMap from "p-map";

import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { TokenPrice } from "@grants-stack-indexer/pricing";
import {
    existsHandler,
    UnsupportedEventException,
    UnsupportedStrategy,
} from "@grants-stack-indexer/processors";
import {
    Changeset,
    IEventRegistryRepository,
    RoundNotFound,
    RoundNotFoundForId,
} from "@grants-stack-indexer/repository";
import {
    Address,
    AnyEvent,
    AnyIndexerFetchedEvent,
    ChainId,
    ContractName,
    Hex,
    ILogger,
    INotifier,
    isAlloEvent,
    isStrategyEvent,
    ProcessorEvent,
    RetriableError,
    RetryHandler,
    RetryStrategy,
    StrategyEvent,
    stringify,
    TimestampMs,
    Token,
    TOKENS_SOURCE_CODES,
} from "@grants-stack-indexer/shared";

import type { IEventsFetcher, IStrategyRegistry } from "./interfaces/index.js";
import { MAX_BULK_FETCH_METADATA_CONCURRENCY } from "./constants.js";
import { EventsFetcher } from "./eventsFetcher.js";
import { EventsProcessor } from "./eventsProcessor.js";
import { InvalidEvent } from "./exceptions/index.js";
import { getMetadataCidsFromEvents } from "./helpers/index.js";
import { CoreDependencies, DataLoader, delay, IQueue, iStrategyAbi, Queue } from "./internal.js";

type TokenWithTimestamps = {
    token: { priceSourceCode: Token["priceSourceCode"] };
    timestamps: TimestampMs[];
};

/**
 * Performance tracking data for events
 */
type EventPerformanceData = {
    eventName: string;
    slowCount: number;
    totalDuration: number;
    maxDuration: number;
    minDuration: number;
    lastTimestamp: string;
};

/**
 * The Orchestrator is the central coordinator of the data flow system, managing the interaction between
 * three main components:
 *
 * 1. Events Fetcher: Retrieves blockchain events from the indexer service
 * 2. Events Processor: Processes and transforms raw events into domain events
 * 3. Data Loader: Persists the processed events into the database
 *
 * The Orchestrator implements a continuous processing loop that:
 *
 * 1. Fetches batches of events from the indexer and stores them in an internal queue
 * 1.5 Bulk fetches metadata and prices for the batch, improving performance by reducing the number of requests and parallelizing them
 * 2. Processes each event from the queue:
 *    - For strategy events and PoolCreated from Allo contract, enhances them with strategyId
 *    - Forwards the event to the Events Processor which is in charge of delagating the processing of the event to the correct handler
 *    - Discards events for unsupported strategies or events
 * 3. Loads the processed events into the database via the Data Loader
 *
 * The Orchestrator provides fault tolerance and performance optimization through:
 * - Configurable batch sizes for event fetching
 * - Delayed processing to prevent overwhelming the system
 * - Retry handling with exponential backoff for transient failures
 * - Comprehensive error handling and logging for various failure scenarios
 * - Registry tracking of supported/unsupported strategies and events
 */
export class Orchestrator {
    private readonly eventsQueue: IQueue<ProcessorEvent<ContractName, AnyEvent>>;
    private readonly eventsByBlockContext: Map<number, AnyIndexerFetchedEvent[]>;
    private readonly eventsFetcher: IEventsFetcher;
    private readonly eventsProcessor: EventsProcessor;
    private readonly eventsRegistry: IEventRegistryRepository;
    private readonly strategyRegistry: IStrategyRegistry;
    private readonly dataLoader: DataLoader;
    private readonly retryHandler: RetryHandler;
    private readonly performanceData: Map<string, EventPerformanceData> = new Map();
    private readonly performanceCsvPath: string;
    private readonly slowEventThresholdMs: number = 500; // 0.5 seconds

    /**
     * @param chainId - The chain id
     * @param dependencies - The core dependencies
     * @param indexerClient - The indexer client
     * @param registries - The registries
     * @param fetchLimit - The fetch limit
     * @param retryStrategy - The retry strategy
     * @param fetchDelayInMs - The fetch delay in milliseconds
     */
    constructor(
        public readonly chainId: ChainId,
        private dependencies: Readonly<CoreDependencies>,
        private indexerClient: IIndexerClient,
        private registries: {
            eventsRegistry: IEventRegistryRepository;
            strategyRegistry: IStrategyRegistry;
        },
        private fetchLimit: number = 1000,
        private fetchDelayInMs: number = 10000,
        private retryStrategy: RetryStrategy,
        private logger: ILogger,
        private notifier: INotifier,
        private environment: "development" | "staging" | "production" = "development",
    ) {
        this.eventsFetcher = new EventsFetcher(this.indexerClient);
        this.eventsProcessor = new EventsProcessor(this.chainId, {
            ...this.dependencies,
            logger: this.logger,
        });
        this.eventsRegistry = registries.eventsRegistry;
        this.strategyRegistry = registries.strategyRegistry;
        this.dataLoader = new DataLoader(
            {
                project: this.dependencies.projectRepository,
                round: this.dependencies.roundRepository,
                application: this.dependencies.applicationRepository,
                donation: this.dependencies.donationRepository,
                applicationPayout: this.dependencies.applicationPayoutRepository,
                attestation: this.dependencies.attestationRepository,
                eventRegistry: this.eventsRegistry,
                legacyProject: this.dependencies.legacyProjectRepository,
            },
            this.dependencies.transactionManager,
            this.logger,
        );
        this.eventsQueue = new Queue<ProcessorEvent<ContractName, AnyEvent>>(fetchLimit);
        this.eventsByBlockContext = new Map<number, AnyIndexerFetchedEvent[]>();
        this.retryHandler = new RetryHandler(retryStrategy, this.logger);

        // Set up performance tracking
        this.performanceCsvPath = path.join(process.cwd(), "performance.csv");
        this.initializePerformanceCsv();
    }

    /**
     * Initialize the performance CSV file with headers if it doesn't exist
     */
    private initializePerformanceCsv(): void {
        if (!fs.existsSync(this.performanceCsvPath)) {
            const headers = "timestamp,eventName,duration,chainId\n";
            fs.writeFileSync(this.performanceCsvPath, headers);
        }
    }

    /**
     * Update performance data for an event and write to CSV
     * @param eventName - The name of the event
     * @param duration - The duration in milliseconds
     */
    private updatePerformanceData(eventName: string, duration: number): void {
        const now = new Date().toISOString();

        // Update in-memory tracking
        if (!this.performanceData.has(eventName)) {
            this.performanceData.set(eventName, {
                eventName,
                slowCount: 0,
                totalDuration: 0,
                maxDuration: 0,
                minDuration: Number.MAX_SAFE_INTEGER,
                lastTimestamp: now,
            });
        }

        const data = this.performanceData.get(eventName)!;
        data.totalDuration += duration;
        data.maxDuration = Math.max(data.maxDuration, duration);
        data.minDuration = Math.min(data.minDuration, duration);
        data.lastTimestamp = now;

        if (duration > this.slowEventThresholdMs) {
            data.slowCount++;
        }

        // Write to CSV file
        const csvLine = `${now},${eventName},${duration.toFixed(2)},${this.chainId}\n`;
        fs.appendFileSync(this.performanceCsvPath, csvLine);

        // Log summary every 100 slow events
        if (data.slowCount % 100 === 0 && data.slowCount > 0) {
            this.logger.info(`Performance summary for ${eventName}:`, {
                className: Orchestrator.name,
                chainId: this.chainId,
                slowCount: data.slowCount,
                avgDuration: (data.totalDuration / data.slowCount).toFixed(2),
                maxDuration: data.maxDuration.toFixed(2),
                minDuration: data.minDuration.toFixed(2),
            });
        }
    }

    async run(signal: AbortSignal): Promise<void> {
        let totalEvents = 0;
        let processedEvents = 0;

        while (!signal.aborted) {
            let event: ProcessorEvent<ContractName, AnyEvent> | undefined;
            try {
                if (this.eventsQueue.isEmpty()) {
                    const events = await this.getNextEventsBatch();
                    await this.bulkFetchMetadataAndPricesForBatch(events);
                    await this.enqueueEvents(events);
                    totalEvents += events.length;
                }

                event = this.eventsQueue.pop();
                if (!event) {
                    this.logger.debug(
                        `No event to process, sleeping for ${this.fetchDelayInMs}ms`,
                        {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                        },
                    );
                    await delay(this.fetchDelayInMs);
                    continue;
                }

                await this.retryHandler.execute(
                    async () => {
                        const changesets = await this.handleEvent(event!);
                        if (changesets) {
                            await this.dataLoader.applyChanges([
                                ...changesets,
                                {
                                    type: "InsertProcessedEvent",
                                    args: {
                                        chainId: this.chainId,
                                        processedEvent: {
                                            ...event!,
                                            rawEvent: event,
                                        },
                                    },
                                },
                            ]);
                        } else {
                            await this.dataLoader.applyChanges([
                                {
                                    type: "InsertProcessedEvent",
                                    args: {
                                        chainId: this.chainId,
                                        processedEvent: {
                                            ...event!,
                                            rawEvent: event,
                                        },
                                    },
                                },
                            ]);
                        }
                    },
                    { abortSignal: signal },
                );
                processedEvents++;
                if (processedEvents % 1000 === 0) {
                    this.logger.info(`Processed events: ${processedEvents}/${totalEvents}`, {
                        className: Orchestrator.name,
                        chainId: this.chainId,
                    });
                }
            } catch (error: unknown) {
                if (event) {
                    await this.eventsRegistry.saveLastProcessedEvent(this.chainId, {
                        ...event,
                        rawEvent: event,
                    });
                }
                if (
                    error instanceof UnsupportedStrategy ||
                    error instanceof InvalidEvent ||
                    error instanceof UnsupportedEventException
                ) {
                    this.logger.debug(
                        `Current event cannot be handled. ${error.name}: ${error.message}.`,
                        {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            event,
                        },
                    );
                } else {
                    if (error instanceof RetriableError) {
                        error.message = `Error processing event after retries. ${error.message}`;
                        this.logger.error(error, {
                            event,
                            className: Orchestrator.name,
                            chainId: this.chainId,
                        });
                        void this.notifier.send(error.message, {
                            chainId: this.chainId,
                            event: event!,
                            stack: error.getFullStack(),
                        });
                    } else if (error instanceof Error || isNativeError(error)) {
                        const shouldIgnoreError = this.shouldIgnoreTimestampsUpdatedError(
                            error,
                            event!,
                        );
                        if (!shouldIgnoreError) {
                            this.logger.error(error, {
                                event,
                                className: Orchestrator.name,
                                chainId: this.chainId,
                            });
                            void this.notifier.send(error.message, {
                                chainId: this.chainId,
                                event: event!,
                                stack: error.stack,
                            });
                        }
                    } else {
                        this.logger.error(
                            new Error(`Error processing event: ${stringify(event)} ${error}`),
                            {
                                className: Orchestrator.name,
                                chainId: this.chainId,
                            },
                        );
                        void this.notifier.send(
                            `Error processing event: ${stringify(event)} ${error}`,
                            {
                                chainId: this.chainId,
                                event: event!,
                            },
                        );
                    }
                }
            }
        }

        this.logger.info("Shutdown signal received. Exiting...", {
            className: Orchestrator.name,
            chainId: this.chainId,
        });
    }

    /**
     * Sometimes the TimestampsUpdated event is part of the _initialize() function of a strategy.
     * In this case, the event is emitted before the PoolCreated event. We can safely ignore the error
     * if the PoolCreated event is present in the same block.
     * @param error - The error
     * @param event - The event
     * @returns True if the error should be ignored, false otherwise
     */
    private shouldIgnoreTimestampsUpdatedError(
        error: Error,
        event: ProcessorEvent<ContractName, AnyEvent>,
    ): boolean {
        const canIgnoreErrorClass =
            error instanceof RoundNotFound || error instanceof RoundNotFoundForId;
        const canIgnoreEventName =
            event?.eventName === "TimestampsUpdated" ||
            event?.eventName === "TimestampsUpdatedWithRegistrationAndAllocation";

        if (canIgnoreErrorClass && canIgnoreEventName) {
            const events = this.eventsByBlockContext.get(event.blockNumber);
            return (
                events
                    ?.filter((e) => e.logIndex > event.logIndex)
                    .some((event) => event.eventName === "PoolCreated") ?? false
            );
        }

        return false;
    }

    /**
     * Fetches the next events batch from the indexer
     * @returns The next events batch
     */
    private async getNextEventsBatch(): Promise<AnyIndexerFetchedEvent[]> {
        const lastProcessedEvent = await this.eventsRegistry.getLastProcessedEvent(this.chainId);

        const blockNumber = lastProcessedEvent?.blockNumber ?? 0;
        const logIndex = lastProcessedEvent?.logIndex ?? 0;

        const events = await this.eventsFetcher.fetchEventsByBlockNumberAndLogIndex({
            chainId: this.chainId,
            blockNumber,
            logIndex,
            limit: this.fetchLimit,
        });

        return events;
    }

    /**
     * Clear pricing and metadata caches and bulk fetch metadata and prices for the batch
     * @param events - The events batch
     */
    private async bulkFetchMetadataAndPricesForBatch(
        events: AnyIndexerFetchedEvent[],
    ): Promise<void> {
        if (events.length === 0) return;
        // Clear caches if the provider supports it
        await this.dependencies.metadataProvider.clearCache?.();
        await this.dependencies.pricingProvider.clearCache?.();

        const metadataIds = getMetadataCidsFromEvents(events, this.logger);
        const tokens = TOKENS_SOURCE_CODES.map((code) => ({
            token: {
                priceSourceCode: code,
            },
            timestamps: events.map((e) => e.blockTimestamp),
        }));

        await Promise.allSettled([
            this.bulkFetchMetadata(metadataIds),
            this.bulkFetchTokens(tokens),
        ]);
    }

    /**
     * Enqueue events and updates new context of events by block number for the batch
     * @param events - The events batch
     */
    private async enqueueEvents(events: AnyIndexerFetchedEvent[]): Promise<void> {
        // Clear previous context
        this.eventsByBlockContext.clear();
        for (const event of events) {
            if (!this.eventsByBlockContext.has(event.blockNumber)) {
                this.eventsByBlockContext.set(event.blockNumber, []);
            }
            this.eventsByBlockContext.get(event.blockNumber)!.push(event);
        }

        this.eventsQueue.push(...events);
    }

    /**
     * Fetch all possible metadata for the batch.
     * @param metadataIds - The metadata ids
     * @returns The metadata
     */
    private async bulkFetchMetadata(metadataIds: string[]): Promise<unknown[]> {
        const results = await pMap(
            metadataIds,
            async (id) => {
                try {
                    const result =
                        await this.dependencies.metadataProvider.getMetadata<unknown>(id);
                    return { status: "fulfilled", value: result };
                } catch (error) {
                    return { status: "rejected", reason: error };
                }
            },
            { concurrency: MAX_BULK_FETCH_METADATA_CONCURRENCY },
        );

        const metadata: unknown[] = [];
        for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
                metadata.push(result.value);
            }
        }

        return metadata;
    }

    /**
     * Fetch all tokens prices
     * @param tokens - The tokens with timestamps
     * @returns The token prices
     */
    private async bulkFetchTokens(tokens: TokenWithTimestamps[]): Promise<TokenPrice[]> {
        const results = await Promise.allSettled(
            tokens.map(({ token, timestamps }) =>
                this.retryHandler.execute(async () => {
                    const prices = await this.dependencies.pricingProvider.getTokenPrices(
                        token.priceSourceCode,
                        timestamps,
                    );
                    return prices;
                }),
            ),
        );
        const tokenPrices: TokenPrice[] = [];
        for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
                tokenPrices.push(...result.value);
            }
        }
        return tokenPrices;
    }

    private async handleEvent(
        event: ProcessorEvent<ContractName, AnyEvent>,
    ): Promise<Changeset[] | undefined> {
        const eventName = `${event.contractName}.${event.eventName}`;
        const timerLabel = `Event: ${eventName}`;

        console.time(timerLabel);
        const startTime = performance.now();

        try {
            event = await this.enhanceStrategyId(event);
            if (this.isPoolCreated(event)) {
                const handleable = existsHandler(event.strategyId);
                await this.strategyRegistry.saveStrategyId(
                    this.chainId,
                    event.params.strategy,
                    event.strategyId,
                    handleable,
                );
            } else if (event.contractName === "Strategy" && "strategyId" in event) {
                if (!existsHandler(event.strategyId)) {
                    this.logger.debug("Skipping event", {
                        event,
                        className: Orchestrator.name,
                        chainId: this.chainId,
                    });
                    // we skip the event if the strategy id is not handled yet
                    return undefined;
                }
            }

            return this.eventsProcessor.processEvent(event);
        } finally {
            console.timeEnd(timerLabel);

            // Calculate duration
            const endTime = performance.now();
            const duration = endTime - startTime;

            // Update performance tracking
            this.updatePerformanceData(eventName, duration);

            // Log slow events
            if (duration > this.slowEventThresholdMs) {
                this.logger.warn(
                    `Slow event detected: ${eventName} took ${duration.toFixed(2)}ms`,
                    {
                        className: Orchestrator.name,
                        chainId: this.chainId,
                        eventName,
                        duration,
                    },
                );
            }
        }
    }

    /**
     * Enhance the event with the strategy id when required
     * @param event - The event
     * @returns The event with the strategy id or the same event if strategyId is not required
     *
     * StrategyId is required for the following events:
     * - PoolCreated from Allo contract
     * - Any event from Strategy contract or its implementations
     */
    private async enhanceStrategyId(
        event: ProcessorEvent<ContractName, AnyEvent>,
    ): Promise<ProcessorEvent<ContractName, AnyEvent>> {
        if (!this.requiresStrategyId(event)) {
            return event;
        }

        const strategyAddress = this.getStrategyAddress(event);
        const strategyId = await this.getOrFetchStrategyId(strategyAddress);
        event.strategyId = strategyId;

        return event;
    }

    /**
     * Get the strategy address from the event
     * @param event - The event
     * @returns The strategy address
     */
    private getStrategyAddress(
        event: ProcessorEvent<"Allo", "PoolCreated"> | ProcessorEvent<"Strategy", StrategyEvent>,
    ): Address {
        return isAlloEvent(event) && event.eventName === "PoolCreated"
            ? event.params.strategy
            : event.srcAddress;
    }

    /**
     * Get the strategy id from the strategy registry or fetch it from the chain
     * @param strategyAddress - The strategy address
     * @returns The strategy id
     */
    private async getOrFetchStrategyId(strategyAddress: Address): Promise<Hex> {
        const cachedStrategy = await this.strategyRegistry.getStrategyId(
            this.chainId,
            strategyAddress,
        );
        if (cachedStrategy) {
            return cachedStrategy.id;
        }

        const strategyId = await this.dependencies.evmProvider.readContract(
            strategyAddress,
            iStrategyAbi,
            "getStrategyId",
        );

        return strategyId;
    }

    /**
     * Check if the event is a PoolCreated event from Allo contract
     * @param event - The event
     * @returns True if the event is a PoolCreated event from Allo contract, false otherwise
     */
    private isPoolCreated(
        event: ProcessorEvent<ContractName, AnyEvent>,
    ): event is ProcessorEvent<"Allo", "PoolCreated"> {
        return isAlloEvent(event) && event.eventName === "PoolCreated";
    }

    /**
     * Check if the event requires a strategy id
     * @param event - The event
     * @returns True if the event requires a strategy id, false otherwise
     */
    private requiresStrategyId(
        event: ProcessorEvent<ContractName, AnyEvent>,
    ): event is ProcessorEvent<"Allo", "PoolCreated"> | ProcessorEvent<"Strategy", StrategyEvent> {
        return this.isPoolCreated(event) || isStrategyEvent(event);
    }
}
