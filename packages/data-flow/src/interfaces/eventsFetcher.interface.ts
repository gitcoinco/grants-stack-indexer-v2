import {
    GetEventsAfterBlockNumberAndLogIndexParams,
    GetEventsFilters,
} from "@grants-stack-indexer/indexer-client";
import { AnyIndexerFetchedEvent } from "@grants-stack-indexer/shared";

/**
 * Interface for the events fetcher
 */
export interface IEventsFetcher {
    /**
     * Fetch the events by block number and log index for a chain
     * @param chainId id of the chain
     * @param blockNumber block number to fetch events from
     * @param logIndex log index in the block to fetch events from
     * @param limit limit of events to fetch\
     * @param lastBlockComplete Whether to fetch the last block completely
     */
    fetchEventsByBlockNumberAndLogIndex(
        params: GetEventsAfterBlockNumberAndLogIndexParams,
    ): Promise<AnyIndexerFetchedEvent[]>;

    /**
     * Fetch the events by src address, block number and log index for a chain
     * @param chainId id of the chain
     * @param srcAddresses src addresses to fetch events from
     * @param toBlock block number to fetch events from
     * @param logIndex log index in the block to fetch events from
     * @param limit limit of events to fetch
     */
    fetchEvents(params: GetEventsFilters): Promise<AnyIndexerFetchedEvent[]>;
}
