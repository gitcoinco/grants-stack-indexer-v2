import { isNativeError } from "util/types";

import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import {
    existsHandler,
    UnsupportedEventException,
    UnsupportedStrategy,
} from "@grants-stack-indexer/processors";
import { RoundNotFound, RoundNotFoundForId } from "@grants-stack-indexer/repository";
import {
    Address,
    AnyEvent,
    AnyIndexerFetchedEvent,
    ChainId,
    ContractName,
    Hex,
    ILogger,
    isAlloEvent,
    isStrategyEvent,
    ProcessorEvent,
    RetriableError,
    RetryHandler,
    RetryStrategy,
    StrategyEvent,
    stringify,
} from "@grants-stack-indexer/shared";

import type { IEventsFetcher, IEventsRegistry, IStrategyRegistry } from "./interfaces/index.js";
import { EventsFetcher } from "./eventsFetcher.js";
import { EventsProcessor } from "./eventsProcessor.js";
import { InvalidEvent } from "./exceptions/index.js";
import { CoreDependencies, DataLoader, delay, IQueue, iStrategyAbi, Queue } from "./internal.js";

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
 *
 * TODO: Enhance logging and observability
 */
export class Orchestrator {
    private readonly eventsQueue: IQueue<ProcessorEvent<ContractName, AnyEvent>>;
    private readonly eventsByBlockContext: Map<number, AnyIndexerFetchedEvent[]>;
    private readonly eventsFetcher: IEventsFetcher;
    private readonly eventsProcessor: EventsProcessor;
    private readonly eventsRegistry: IEventsRegistry;
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
            eventsRegistry: IEventsRegistry;
            strategyRegistry: IStrategyRegistry;
        },
        private fetchLimit: number = 1000,
        private fetchDelayInMs: number = 10000,
        private retryStrategy: RetryStrategy,
        private logger: ILogger,
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
            },
            this.dependencies.transactionManager,
            this.logger,
        );
        this.eventsQueue = new Queue<ProcessorEvent<ContractName, AnyEvent>>(fetchLimit);
        this.eventsByBlockContext = new Map<number, AnyIndexerFetchedEvent[]>();
        this.retryHandler = new RetryHandler(retryStrategy, this.logger);
    }

    async run(signal: AbortSignal): Promise<void> {
        while (!signal.aborted) {
            let event: ProcessorEvent<ContractName, AnyEvent> | undefined;
            try {
                if (this.eventsQueue.isEmpty()) await this.enqueueEvents();

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

                await this.eventsRegistry.saveLastProcessedEvent(this.chainId, {
                    ...event,
                    rawEvent: event,
                });

                await this.retryHandler.execute(
                    async () => {
                        await this.handleEvent(event!);
                    },
                    { abortSignal: signal },
                );
            } catch (error: unknown) {
                // TODO: notify
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
                        }
                    } else {
                        this.logger.error(
                            new Error(`Error processing event: ${stringify(event)} ${error}`),
                            {
                                className: Orchestrator.name,
                                chainId: this.chainId,
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
     * Enqueue new events from the events fetcher using the last processed event as a starting point
     */
    private async enqueueEvents(): Promise<void> {
        const lastProcessedEvent = await this.eventsRegistry.getLastProcessedEvent(this.chainId);
        const blockNumber = lastProcessedEvent?.blockNumber ?? 0;
        const logIndex = lastProcessedEvent?.logIndex ?? 0;

        const events = await this.eventsFetcher.fetchEventsByBlockNumberAndLogIndex({
            chainId: this.chainId,
            blockNumber,
            logIndex,
            limit: this.fetchLimit,
            allowPartialLastBlock: false,
        });

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

    private async handleEvent(event: ProcessorEvent<ContractName, AnyEvent>): Promise<void> {
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
                return;
            }
        }

        const changesets = await this.eventsProcessor.processEvent(event);
        await this.dataLoader.applyChanges(changesets);
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
