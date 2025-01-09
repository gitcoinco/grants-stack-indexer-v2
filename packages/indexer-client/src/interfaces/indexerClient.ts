import { AnyIndexerFetchedEvent, ChainId } from "@grants-stack-indexer/shared";

import { GetEventsFilters } from "../internal.js";

export type GetEventsAfterBlockNumberAndLogIndexParams = {
    chainId: ChainId;
    blockNumber: number;
    logIndex: number;
    limit?: number;
    lastBlockComplete?: boolean;
};

/**
 * Interface for the indexer client
 */
export interface IIndexerClient {
    /**
     * Get the events by block number and log index from the indexer service
     * @param chainId Id of the chain
     * @param blockNumber Block number to start fetching events from
     * @param logIndex Log index in the block
     * @param limit Limit of events to fetch
     * @param lastBlockComplete Whether to fetch the last block completely
     */
    getEventsAfterBlockNumberAndLogIndex(
        params: GetEventsAfterBlockNumberAndLogIndexParams,
    ): Promise<AnyIndexerFetchedEvent[]>;

    /**
     * Get the events by filters from the indexer service
     * @param params Filters to fetch events
     * @returns Events fetched from the indexer service
     */
    getEvents(params: GetEventsFilters): Promise<AnyIndexerFetchedEvent[]>;
}
