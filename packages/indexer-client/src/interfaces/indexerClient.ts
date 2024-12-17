import { Address, AnyIndexerFetchedEvent, ChainId } from "@grants-stack-indexer/shared";

/**
 * Interface for the indexer client
 */
export interface IIndexerClient {
    /**
     * Get the events by block number and log index from the indexer service
     * @param chainId Id of the chain
     * @param fromBlock Block number to start fetching events from
     * @param logIndex Log index in the block
     * @param limit Limit of events to fetch
     */
    getEventsAfterBlockNumberAndLogIndex(
        chainId: ChainId,
        fromBlock: number,
        logIndex: number,
        limit?: number,
    ): Promise<AnyIndexerFetchedEvent[]>;

    /**
     * Get the events by src address from the indexer service
     * @param chainId Id of the chain
     * @param srcAddresses Src addresses to fetch events from
     * @param from Block number to start fetching events from
     * @param logIndex Log index in the block
     * @param limit Limit of events to fetch
     */
    getEventsBySrcAddress(params: {
        chainId: ChainId;
        srcAddresses: Address[];
        from?: {
            blockNumber?: number;
            logIndex?: number;
        };
        to: {
            blockNumber: number;
            logIndex: number;
        };
        limit?: number;
    }): Promise<AnyIndexerFetchedEvent[]>;
}
