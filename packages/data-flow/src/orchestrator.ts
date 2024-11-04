import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import {
    existsHandler,
    UnsupportedEventException,
    UnsupportedStrategy,
} from "@grants-stack-indexer/processors";
import {
    Address,
    AnyEvent,
    ChainId,
    ContractName,
    Hex,
    isAlloEvent,
    isStrategyEvent,
    ProcessorEvent,
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
 * - Error handling and logging for various failure scenarios
 * - Registry tracking of supported/unsupported strategies and events
 *
 * TODO: Enhance the error handling/retries, logging and observability
 * TODO: Handle unhandled strategies appropriately
 */
export class Orchestrator {
    private readonly eventsQueue: IQueue<ProcessorEvent<ContractName, AnyEvent>>;
    private readonly eventsFetcher: IEventsFetcher;
    private readonly eventsProcessor: EventsProcessor;
    private readonly eventsRegistry: IEventsRegistry;
    private readonly strategyRegistry: IStrategyRegistry;
    private readonly dataLoader: DataLoader;

    /**
     * @param chainId - The chain id
     * @param dependencies - The core dependencies
     * @param indexerClient - The indexer client
     * @param registries - The registries
     * @param fetchLimit - The fetch limit
     * @param fetchDelayInMs - The fetch delay in milliseconds
     */
    constructor(
        private chainId: ChainId,
        private dependencies: Readonly<CoreDependencies>,
        private indexerClient: IIndexerClient,
        private registries: {
            eventsRegistry: IEventsRegistry;
            strategyRegistry: IStrategyRegistry;
        },
        private fetchLimit: number = 1000,
        private fetchDelayInMs: number = 10000,
    ) {
        this.eventsFetcher = new EventsFetcher(this.indexerClient);
        this.eventsProcessor = new EventsProcessor(this.chainId, this.dependencies);
        this.eventsRegistry = registries.eventsRegistry;
        this.strategyRegistry = registries.strategyRegistry;
        this.dataLoader = new DataLoader({
            project: this.dependencies.projectRepository,
            round: this.dependencies.roundRepository,
            application: this.dependencies.applicationRepository,
        });
        this.eventsQueue = new Queue<ProcessorEvent<ContractName, AnyEvent>>(fetchLimit);
    }

    async run(signal: AbortSignal): Promise<void> {
        while (!signal.aborted) {
            let event: ProcessorEvent<ContractName, AnyEvent> | undefined;
            try {
                if (this.eventsQueue.isEmpty()) await this.enqueueEvents();

                event = this.eventsQueue.pop();

                if (!event) {
                    await delay(this.fetchDelayInMs);
                    continue;
                }

                event = await this.enhanceStrategyId(event);
                if (event.contractName === "Strategy" && "strategyId" in event) {
                    if (!existsHandler(event.strategyId)) {
                        //TODO: save to registry as unsupported strategy, so when the strategy is handled it will be backwards compatible and process all of the events
                        console.log(
                            `No handler found for strategyId: ${event.strategyId}. Event: ${stringify(
                                event,
                            )}`,
                        );
                        continue;
                    }
                }

                const changesets = await this.eventsProcessor.processEvent(event);
                const executionResult = await this.dataLoader.applyChanges(changesets);

                if (executionResult.numFailed > 0) {
                    //TODO: should we retry the failed changesets?
                    console.error(
                        `Failed to apply changesets. ${executionResult.errors.join("\n")} Event: ${stringify(
                            event,
                        )}`,
                    );
                } else {
                    await this.eventsRegistry.saveLastProcessedEvent(event);
                }
            } catch (error: unknown) {
                // TODO: improve error handling, retries and notify
                if (
                    error instanceof UnsupportedStrategy ||
                    error instanceof InvalidEvent ||
                    error instanceof UnsupportedEventException
                ) {
                    console.error(
                        `Current event cannot be handled. ${error.name}: ${error.message}. Event: ${stringify(event)}`,
                    );
                } else {
                    console.error(`Error processing event: ${stringify(event)}`, error);
                }
            }
        }

        console.log("Shutdown signal received. Exiting...");
    }

    /**
     * Enqueue new events from the events fetcher using the last processed event as a starting point
     */
    private async enqueueEvents(): Promise<void> {
        const lastProcessedEvent = await this.eventsRegistry.getLastProcessedEvent();
        const blockNumber = lastProcessedEvent?.blockNumber ?? 0;
        const logIndex = lastProcessedEvent?.logIndex ?? 0;

        const events = await this.eventsFetcher.fetchEventsByBlockNumberAndLogIndex(
            this.chainId,
            blockNumber,
            logIndex,
            this.fetchLimit,
        );

        this.eventsQueue.push(...events);
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
        const existingId = await this.strategyRegistry.getStrategyId(strategyAddress);
        if (existingId) {
            return existingId;
        }

        const strategyId = await this.dependencies.evmProvider.readContract(
            strategyAddress,
            iStrategyAbi,
            "getStrategyId",
        );

        await this.strategyRegistry.saveStrategyId(strategyAddress, strategyId);

        return strategyId;
    }

    /**
     * Check if the event requires a strategy id
     * @param event - The event
     * @returns True if the event requires a strategy id, false otherwise
     */
    private requiresStrategyId(
        event: ProcessorEvent<ContractName, AnyEvent>,
    ): event is ProcessorEvent<"Allo", "PoolCreated"> | ProcessorEvent<"Strategy", StrategyEvent> {
        return (isAlloEvent(event) && event.eventName === "PoolCreated") || isStrategyEvent(event);
    }
}
