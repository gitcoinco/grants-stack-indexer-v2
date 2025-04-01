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
                        this.logger.debug("Starting event processing", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            eventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                            blockNumber: event!.blockNumber,
                            logIndex: event!.logIndex,
                        });

                        const changesets = await this.handleEvent(event!);

                        this.logger.debug("Event handling completed", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            hasChangesets: !!changesets,
                            changesetsCount: changesets?.length ?? 0,
                            eventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                        });

                        if (changesets) {
                            this.logger.debug("Applying changesets with processed event", {
                                className: Orchestrator.name,
                                chainId: this.chainId,
                                totalChangesets: changesets.length + 1,
                                eventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                            });

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
                            this.logger.debug("Applying only processed event record", {
                                className: Orchestrator.name,
                                chainId: this.chainId,
                                eventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                            });

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

                        this.logger.debug("Changes applied successfully", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            eventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                        });
                    },
                    { abortSignal: signal },
                );
                processedEvents++;
                this.logger.info(`Processed events: ${processedEvents}/${totalEvents}`, {
                    className: Orchestrator.name,
                    chainId: this.chainId,
                    progress: `${((processedEvents / totalEvents) * 100).toFixed(2)}%`,
                    currentEventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                    currentBlock: event!.blockNumber,
                });
            } catch (error: unknown) {
                this.logger.warn("Error encountered during event processing", {
                    className: Orchestrator.name,
                    chainId: this.chainId,
                    eventIdentifier: event ? `${event.blockNumber}:${event.logIndex}` : undefined,
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                });

                if (event) {
                    this.logger.debug("Saving last processed event before error handling", {
                        className: Orchestrator.name,
                        chainId: this.chainId,
                        eventIdentifier: `${event.blockNumber}:${event.logIndex}`,
                        blockNumber: event.blockNumber,
                    });

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
                            errorType: error.constructor.name,
                            errorDetails: error.message,
                        },
                    );
                } else {
                    if (error instanceof RetriableError) {
                        this.logger.debug("Processing RetriableError", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            errorType: "RetriableError",
                            eventIdentifier: event
                                ? `${event.blockNumber}:${event.logIndex}`
                                : undefined,
                        });

                        error.message = `Error processing event after retries. ${error.message}`;
                        this.logger.error(error, {
                            event,
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            lastRetryDelay: error.metadata?.retryAfterInMs,
                            reason: error.metadata?.failureReason,
                        });

                        this.logger.debug("Sending notification for RetriableError", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            eventIdentifier: event
                                ? `${event.blockNumber}:${event.logIndex}`
                                : undefined,
                        });

                        void this.notifier.send(error.message, {
                            chainId: this.chainId,
                            event: event!,
                            stack: error.getFullStack(),
                        });
                    } else if (error instanceof Error || isNativeError(error)) {
                        this.logger.debug("Processing standard Error", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            errorType: error.constructor.name,
                            eventIdentifier: event
                                ? `${event.blockNumber}:${event.logIndex}`
                                : undefined,
                        });

                        const shouldIgnoreError = this.shouldIgnoreTimestampsUpdatedError(
                            error,
                            event!,
                        );

                        this.logger.debug("Checking if error should be ignored", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            shouldIgnoreError,
                            errorType: error.constructor.name,
                            eventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                            errorMessage: error.message,
                        });

                        if (!shouldIgnoreError) {
                            this.logger.debug("Error not ignored, preparing to send notification", {
                                className: Orchestrator.name,
                                chainId: this.chainId,
                                eventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                                errorType: error.constructor.name,
                            });

                            this.logger.error(error, {
                                event,
                                className: Orchestrator.name,
                                chainId: this.chainId,
                                errorStack: error.stack,
                            });

                            this.logger.debug("Sending notification for standard error", {
                                className: Orchestrator.name,
                                chainId: this.chainId,
                                eventIdentifier: `${event!.blockNumber}:${event!.logIndex}`,
                            });

                            void this.notifier.send(error.message, {
                                chainId: this.chainId,
                                event: event!,
                                stack: error.stack,
                            });
                        }
                    } else {
                        this.logger.debug("Processing unknown error type", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            errorType: typeof error,
                            eventIdentifier: event
                                ? `${event.blockNumber}:${event.logIndex}`
                                : undefined,
                        });

                        const errorMessage = `Error processing event: ${stringify(event)} ${error}`;

                        this.logger.debug("Created error message for unknown error", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            errorMessage,
                            eventIdentifier: event
                                ? `${event.blockNumber}:${event.logIndex}`
                                : undefined,
                        });

                        this.logger.error(new Error(errorMessage), {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            unknownErrorType: typeof error,
                        });

                        this.logger.debug("Sending notification for unknown error", {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            eventIdentifier: event
                                ? `${event.blockNumber}:${event.logIndex}`
                                : undefined,
                        });

                        void this.notifier.send(errorMessage, {
                            chainId: this.chainId,
                            event: event!,
                        });
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
        this.logger.info(`Starting bulk fetch for ${tokens.length} token prices`, {
            className: Orchestrator.name,
            chainId: this.chainId,
            tokens: tokens.map((t) => t.token.priceSourceCode),
            timestampCount: tokens[0]?.timestamps.length ?? 0,
        });

        const results = await Promise.allSettled(
            tokens.map(({ token, timestamps }) =>
                this.retryHandler.execute(async () => {
                    this.logger.debug(`Fetching prices for token ${token.priceSourceCode}`, {
                        className: Orchestrator.name,
                        chainId: this.chainId,
                        timestampCount: timestamps.length,
                    });

                    try {
                        const prices = await this.dependencies.pricingProvider.getTokenPrices(
                            token.priceSourceCode,
                            timestamps,
                        );
                        this.logger.debug(
                            `Successfully fetched prices for ${token.priceSourceCode}`,
                            {
                                className: Orchestrator.name,
                                chainId: this.chainId,
                                priceCount: prices.length,
                            },
                        );
                        return prices;
                    } catch (error) {
                        this.logger.error(`Failed to fetch prices for ${token.priceSourceCode}`, {
                            className: Orchestrator.name,
                            chainId: this.chainId,
                            error: error instanceof Error ? error.message : String(error),
                            timestamps: timestamps.map((t) => new Date(t).toISOString()),
                        });
                        throw error;
                    }
                }),
            ),
        );

        const tokenPrices: TokenPrice[] = [];
        let fulfilledCount = 0;
        let rejectedCount = 0;

        for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
                tokenPrices.push(...result.value);
                fulfilledCount++;
            } else if (result.status === "rejected") {
                rejectedCount++;
                this.logger.warn(`Token price fetch rejected`, {
                    className: Orchestrator.name,
                    chainId: this.chainId,
                    error:
                        result.reason instanceof Error
                            ? result.reason.message
                            : String(result.reason),
                });
            }
        }

        this.logger.info(`Completed bulk token price fetch`, {
            className: Orchestrator.name,
            chainId: this.chainId,
            totalRequests: results.length,
            successful: fulfilledCount,
            failed: rejectedCount,
            totalPricesFetched: tokenPrices.length,
        });

        return tokenPrices;
    }

    private async handleEvent(
        event: ProcessorEvent<ContractName, AnyEvent>,
    ): Promise<Changeset[] | undefined> {
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
