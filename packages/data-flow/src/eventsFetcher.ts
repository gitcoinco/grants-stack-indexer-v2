import { GetEventsFilters, IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { AnyIndexerFetchedEvent, ChainId } from "@grants-stack-indexer/shared";

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
    async fetchEvents(params: GetEventsFilters): Promise<AnyIndexerFetchedEvent[]> {
        return this.indexerClient.getEvents(params);
    }
}
