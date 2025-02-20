import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { existsHandler, UnsupportedEventException } from "@grants-stack-indexer/processors";
import {
    IEventRegistryRepository,
    IStrategyProcessingCheckpointRepository,
} from "@grants-stack-indexer/repository";
import {
    Address,
    AnyEvent,
    ChainId,
    ContractName,
    Hex,
    ILogger,
    ProcessorEvent,
    RetryHandler,
    RetryStrategy,
    stringify,
} from "@grants-stack-indexer/shared";

import {
    CoreDependencies,
    DataLoader,
    EventsFetcher,
    EventsProcessor,
    IEventsFetcher,
    InvalidEvent,
    IStrategyRegistry,
    Queue,
} from "./internal.js";

/**
 * Represents a pointer to a specific event in the blockchain
 */
type EventPointer = {
    /** The block number where the event occurred */
    blockNumber: number;
    /** The log index within the block */
    logIndex: number;
};

/**
 * The RetroactiveProcessor is responsible for processing historical events from strategies
 * that were previously unsupported but are now handleable. This allows the system to
 * catch up on missed events and maintain data consistency.
 *
 * Key responsibilities:
 * 1. Identify newly handleable strategies that were previously unsupported
 * 2. Fetch historical events for these strategies from the Indexer client
 * 3. Process events through the appropriate handlers to update system state
 * 4. Update strategy registry with processed status
 * 5. Track processing progress via checkpoints to enable resumability
 *
 * The checkpoint registry maintains processing state for each strategy, storing:
 * - Last processed block number and log index
 *
 * This enables the processor to:
 * - Resume processing from last checkpoint after interruption
 * - Track multiple strategies independently
 * - Provide processing status visibility
 * - Ensure exactly-once processing semantics
 */
export class RetroactiveProcessor {
    private readonly eventsFetcher: IEventsFetcher;
    private readonly eventsProcessor: EventsProcessor;
    private readonly eventsRegistry: IEventRegistryRepository;
    private readonly strategyRegistry: IStrategyRegistry;
    private readonly dataLoader: DataLoader;
    private readonly checkpointRepository: IStrategyProcessingCheckpointRepository;
    private readonly retryHandler: RetryHandler;

    /**
     * Creates a new instance of RetroactiveProcessor
     * @param chainId - The blockchain network identifier
     * @param dependencies - Core system dependencies for data access and processing
     * @param indexerClient - Client for fetching blockchain events
     * @param registries - Event and strategy registries for tracking processing state
     * @param fetchLimit - Maximum number of events to fetch in a single batch (default: 1000)
     * @param retryStrategy - The retry strategy
     * @param logger - Logger instance for debugging and monitoring
     */
    constructor(
        public readonly chainId: ChainId,
        private dependencies: Readonly<CoreDependencies>,
        private indexerClient: IIndexerClient,
        private registries: {
            eventsRegistry: IEventRegistryRepository;
            strategyRegistry: IStrategyRegistry;
            checkpointRepository: IStrategyProcessingCheckpointRepository;
        },
        private fetchLimit: number = 1000,
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
        this.checkpointRepository = registries.checkpointRepository;
        this.dataLoader = new DataLoader(
            {
                project: this.dependencies.projectRepository,
                round: this.dependencies.roundRepository,
                application: this.dependencies.applicationRepository,
                donation: this.dependencies.donationRepository,
                applicationPayout: this.dependencies.applicationPayoutRepository,
                eventRegistry: this.eventsRegistry,
            },
            this.dependencies.transactionManager,
            this.logger,
        );
        this.retryHandler = new RetryHandler(retryStrategy, this.logger);
    }

    /**
     * Process historical events for all strategies that are now handleable but weren't before
     * @returns Promise that resolves when all retroactive processing is complete
     */
    async processRetroactiveStrategies(): Promise<void> {
        this.logger.info(`Processing retroactive strategies`, {
            className: RetroactiveProcessor.name,
            chainId: this.chainId,
        });

        const newHandleableStrategies = await this.findNewHandleableStrategies();

        if (newHandleableStrategies.size === 0) {
            this.logger.info("No new handleable strategies found", {
                className: RetroactiveProcessor.name,
                chainId: this.chainId,
            });
            return;
        }

        const lastEvent = await this.eventsRegistry.getLastProcessedEvent(this.chainId);
        const lastEventPointer: EventPointer = {
            blockNumber: lastEvent?.blockNumber ?? 0,
            logIndex: lastEvent?.logIndex ?? 0,
        };

        const results = await Promise.allSettled(
            Array.from(newHandleableStrategies.entries()).map(
                async ([strategyId, strategyAddresses]) => {
                    try {
                        await this.processRetroactiveStrategy(
                            strategyId,
                            strategyAddresses,
                            lastEventPointer,
                        );
                    } catch (error) {
                        this.logger.error(
                            `Failed to process strategy ${strategyId}: ${error instanceof Error ? error.message : String(error)}`,
                            {
                                className: RetroactiveProcessor.name,
                                chainId: this.chainId,
                            },
                        );
                        throw error;
                    }
                },
            ),
        );

        // Log results summary
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected").length;
        this.logger.info(
            `Retroactive processing complete. Succeeded: ${succeeded}, Failed: ${failed}`,
            {
                className: RetroactiveProcessor.name,
                chainId: this.chainId,
            },
        );
    }

    /**
     * Process historical events for a specific strategy
     * @param strategyId - Identifier of the strategy to process
     * @param strategyAddresses - Set of contract addresses implementing this strategy
     * @param lastEventPointer - Latest processed event pointer to process up to
     */
    private async processRetroactiveStrategy(
        strategyId: Hex,
        strategyAddresses: Set<Address>,
        lastEventPointer: Readonly<EventPointer>,
    ): Promise<void> {
        // Check if we have a checkpoint for this strategy
        const checkpoint = await this.checkpointRepository.getCheckpoint(this.chainId, strategyId);

        const currentPointer: EventPointer = checkpoint
            ? {
                  blockNumber: checkpoint.lastProcessedBlockNumber,
                  logIndex: checkpoint.lastProcessedLogIndex,
              }
            : { blockNumber: 0, logIndex: 0 };

        const events = new Queue<ProcessorEvent<ContractName, AnyEvent> & { strategyId?: Hex }>();
        let event: (ProcessorEvent<ContractName, AnyEvent> & { strategyId?: Hex }) | undefined;

        while (true) {
            try {
                await this.enqueueEventsIfEmpty(
                    events,
                    strategyAddresses,
                    currentPointer,
                    lastEventPointer,
                );

                event = events.pop();
                if (!event) break;

                currentPointer.blockNumber = event.blockNumber;
                currentPointer.logIndex = event.logIndex;

                if (this.hasReachedLastEvent(currentPointer, lastEventPointer)) break;

                event.strategyId = strategyId;

                await this.retryHandler.execute(async () => {
                    const changesets = await this.eventsProcessor.processEvent(event!);
                    await this.dataLoader.applyChanges(changesets);
                });
            } catch (error) {
                if (error instanceof InvalidEvent || error instanceof UnsupportedEventException) {
                    // Expected errors that we can safely ignore
                    this.logger.debug(`Skipping error for ${error.name}: ${stringify(event)}`, {
                        className: RetroactiveProcessor.name,
                        chainId: this.chainId,
                    });
                } else {
                    this.logger.error(`Error processing event: ${stringify(event)} ${error}`, {
                        className: RetroactiveProcessor.name,
                        chainId: this.chainId,
                    });
                }
            }

            // Update checkpoint after processing
            await this.updateCheckpoint(strategyId, currentPointer);
        }

        await this.markStrategyAsHandled(strategyId, strategyAddresses);
        // Delete checkpoint after processing of all events
        await this.checkpointRepository.deleteCheckpoint(this.chainId, strategyId);
    }

    /**
     * Update the checkpoint for a strategy
     * @param strategyId - The strategy ID
     * @param currentPointer - The current event pointer
     */
    private async updateCheckpoint(strategyId: Hex, currentPointer: EventPointer): Promise<void> {
        const checkpointData = {
            chainId: this.chainId,
            strategyId,
            lastProcessedBlockNumber: currentPointer.blockNumber,
            lastProcessedLogIndex: currentPointer.logIndex,
        };

        await this.checkpointRepository.upsertCheckpoint(checkpointData);
    }

    /**
     * Enqueue events if the queue is empty
     * @param queue - The queue to enqueue events into
     * @param strategyAddresses - The set of strategy addresses
     * @param currentPointer - The current event pointer
     * @param lastEventPointer - The last event pointer
     */
    private async enqueueEventsIfEmpty(
        queue: Queue<ProcessorEvent<ContractName, AnyEvent> & { strategyId?: Hex }>,
        strategyAddresses: Set<Address>,
        currentPointer: EventPointer,
        lastEventPointer: EventPointer,
    ): Promise<void> {
        if (queue.isEmpty()) {
            const fetchedEvents = await this.eventsFetcher.fetchEvents({
                chainId: this.chainId,
                srcAddresses: Array.from(strategyAddresses),
                from: currentPointer,
                to: lastEventPointer,
                limit: this.fetchLimit,
            });
            if (fetchedEvents.length > 0) queue.push(...fetchedEvents);
        }
    }

    /**
     * Find strategies that were previously unhandled but now have handlers available
     * @returns Map of strategy IDs to their implementation addresses
     */
    private async findNewHandleableStrategies(): Promise<Map<Hex, Set<Address>>> {
        const unhandledStrategies = await this.strategyRegistry.getStrategies({
            handled: false,
            chainId: this.chainId,
        });

        const newHandleableStrategies = new Map<Hex, Set<Address>>();
        for (const strategy of unhandledStrategies) {
            if (existsHandler(strategy.id)) {
                if (!newHandleableStrategies.has(strategy.id)) {
                    newHandleableStrategies.set(strategy.id, new Set());
                }
                newHandleableStrategies.get(strategy.id)?.add(strategy.address);
            }
        }

        return newHandleableStrategies;
    }

    private hasReachedLastEvent(current: EventPointer, last: EventPointer): boolean {
        return (
            current.blockNumber > last.blockNumber ||
            (current.blockNumber === last.blockNumber && current.logIndex >= last.logIndex)
        );
    }

    /**
     * Mark a strategy as handled for all addresses covered by the strategy
     * @param strategyId - The strategy ID
     * @param addresses - The set of strategy addresses
     */
    private async markStrategyAsHandled(strategyId: Hex, addresses: Set<Address>): Promise<void> {
        this.logger.info(`Processed retroactively strategy ${strategyId}`, {
            className: RetroactiveProcessor.name,
            chainId: this.chainId,
        });

        await Promise.all(
            Array.from(addresses).map(async (address) => {
                this.logger.debug(
                    `Marking strategy ${strategyId} as handled for address ${address}`,
                    {
                        className: RetroactiveProcessor.name,
                        chainId: this.chainId,
                    },
                );
                try {
                    await this.strategyRegistry.saveStrategyId(
                        this.chainId,
                        address,
                        strategyId,
                        true,
                    );
                } catch (error: unknown) {
                    this.logger.error(
                        `Failed to mark strategy ${strategyId} as handled: ${error}`,
                        {
                            className: RetroactiveProcessor.name,
                            chainId: this.chainId,
                        },
                    );
                    throw error;
                }
            }),
        );
    }
}
