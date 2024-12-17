import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { Address, AnyIndexerFetchedEvent, ChainId } from "@grants-stack-indexer/shared";

import { IEventsFetcher } from "./interfaces/index.js";

export class EventsFetcher implements IEventsFetcher {
    constructor(private indexerClient: IIndexerClient) {}
    /* @inheritdoc */
    async fetchEventsByBlockNumberAndLogIndex(
        chainId: ChainId,
        blockNumber: number,
        logIndex: number,
        limit: number = 100,
    ): Promise<AnyIndexerFetchedEvent[]> {
        return await this.indexerClient.getEventsAfterBlockNumberAndLogIndex(
            chainId,
            blockNumber,
            logIndex,
            limit,
        );
    }

    /** @inheritdoc */
    async fetchEventsBySrcAddress(params: {
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
    }): Promise<AnyIndexerFetchedEvent[]> {
        return this.indexerClient.getEventsBySrcAddress(params);
    }
}
