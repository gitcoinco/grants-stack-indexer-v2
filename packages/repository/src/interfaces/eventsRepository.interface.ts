import { ChainId } from "@grants-stack-indexer/shared";

import { NewProcessedEvent, ProcessedEvent } from "../types/index.js";

export interface IEventRegistryRepository {
    /**
     * Get the last processed event for a given chain.
     * @param chainId - The chain ID.
     * @returns The last processed event or undefined if none exists.
     */
    getLastProcessedEvent: (chainId: ChainId) => Promise<ProcessedEvent | undefined>;

    /**
     * Save the last processed event for a given chain.
     * @param chainId - The chain ID.
     * @param event - The new processed event to save.
     */
    saveLastProcessedEvent: (chainId: ChainId, event: NewProcessedEvent) => Promise<void>;
}
