import {
    IEventRegistryRepository,
    NewProcessedEvent,
    ProcessedEvent,
} from "@grants-stack-indexer/repository";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { IEventsRegistry } from "../../internal.js";

/**
 * Class to store last processed event of a chain in Database
 */
export class DatabaseEventRegistry implements IEventsRegistry {
    constructor(
        private logger: ILogger,
        private eventRepository: IEventRegistryRepository,
    ) {}

    /** @inheritdoc */
    async getLastProcessedEvent(chainId: ChainId): Promise<ProcessedEvent | undefined> {
        return this.eventRepository.getLastProcessedEvent(chainId);
    }

    /** @inheritdoc */
    async saveLastProcessedEvent(chainId: ChainId, event: NewProcessedEvent): Promise<void> {
        return this.eventRepository.saveLastProcessedEvent(chainId, event);
    }
}
