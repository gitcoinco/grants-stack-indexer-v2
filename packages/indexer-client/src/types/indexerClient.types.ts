import { Address, ChainId } from "@grants-stack-indexer/shared";

export type GetEventsFilters = {
    /**
     * Id of the chain to fetch events from
     */
    chainId: ChainId;
    /**
     * Src addresses to filter events by
     */
    srcAddresses?: Address[];
    from?: {
        /**
         * Block number to start fetching events from
         */
        blockNumber: number;
        /**
         * Log index in the block
         */
        logIndex: number;
    };
    to?: {
        /**
         * Block number to end fetching events at
         */
        blockNumber: number;
        /**
         * Log index in the block
         */
        logIndex: number;
    };
    /**
     * Limit of events to fetch
     */
    limit?: number;
};
