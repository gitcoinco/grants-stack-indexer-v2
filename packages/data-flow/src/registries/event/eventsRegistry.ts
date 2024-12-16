import type { ChainId, ILogger } from "@grants-stack-indexer/shared";
import { NewProcessedEvent, ProcessedEvent } from "@grants-stack-indexer/repository";
import { stringify } from "@grants-stack-indexer/shared";

import type { IEventsRegistry } from "../../internal.js";

/**
 * Class to store the last processed event in memory
 */
//TODO: Implement storage version to persist the last processed event. we need to store it by chainId
export class InMemoryEventsRegistry implements IEventsRegistry {
    private lastProcessedEvent: Map<ChainId, ProcessedEvent> = new Map();

    constructor(private logger: ILogger) {}

    /**
     * @inheritdoc
     */
    async getLastProcessedEvent(chainId: ChainId): Promise<ProcessedEvent | undefined> {
        return this.lastProcessedEvent.get(chainId);
    }

    /**
     * @inheritdoc
     */
    async saveLastProcessedEvent(chainId: ChainId, event: NewProcessedEvent): Promise<void> {
        this.logger.debug(`Saving last processed event: ${stringify(event, undefined, 4)}`);
        this.lastProcessedEvent.set(chainId, { ...event, chainId });
    }
}
