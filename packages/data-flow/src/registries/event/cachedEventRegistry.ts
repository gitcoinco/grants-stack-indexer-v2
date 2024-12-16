import { NewProcessedEvent, ProcessedEvent } from "@grants-stack-indexer/repository";
import { ChainId, ILogger, stringify } from "@grants-stack-indexer/shared";

import { IEventsRegistry } from "../../internal.js";

/**
 * Proxy class to cache the events in memory or fallback to another event registry
 */
export class InMemoryCachedEventRegistry implements IEventsRegistry {
    private cache: Map<ChainId, ProcessedEvent> = new Map();

    private constructor(
        private readonly logger: ILogger,
        private readonly eventRegistry: IEventsRegistry,
        cache: Map<ChainId, ProcessedEvent>,
    ) {
        this.cache = structuredClone(cache);
    }

    /** @inheritdoc */
    async getLastProcessedEvent(chainId: ChainId): Promise<ProcessedEvent | undefined> {
        const cachedEvent = this.cache.get(chainId);
        if (cachedEvent) {
            return cachedEvent;
        }
        const event = await this.eventRegistry.getLastProcessedEvent(chainId);
        if (event) {
            this.cache.set(chainId, event);
        }
        return event;
    }

    /** @inheritdoc */
    async saveLastProcessedEvent(chainId: ChainId, event: NewProcessedEvent): Promise<void> {
        this.logger.debug(`Saving last processed event: ${stringify(event, undefined, 4)}`);
        await this.eventRegistry.saveLastProcessedEvent(chainId, event);
        this.cache.set(chainId, { ...event, chainId });
    }

    /**
    /**
     * Creates a new cached event registry instance. It will load the events into memory and cache them and
     * fallback to the event registry if the event is not found in the cache.
     *
     * @param logger - The logger instance
     * @param eventRegistry - The event registry instance
     * @param chainIds - The chain ids to load the events for
     * @returns The initialized cached event registry
     */
    static async initialize(
        logger: ILogger,
        eventRegistry: IEventsRegistry,
        chainIds: ChainId[],
    ): Promise<InMemoryCachedEventRegistry> {
        const events = await Promise.allSettled(
            chainIds.map(async (chainId) => await eventRegistry.getLastProcessedEvent(chainId)),
        );
        const cache = new Map<ChainId, ProcessedEvent>();

        logger.debug(`Loading events into memory...`);

        for (const event of events) {
            if (event.status === "fulfilled" && event.value) {
                cache.set(event.value.chainId, event.value);
            }
        }

        return new InMemoryCachedEventRegistry(logger, eventRegistry, cache);
    }
}
