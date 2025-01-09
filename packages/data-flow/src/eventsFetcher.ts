import {
    GetEventsAfterBlockNumberAndLogIndexParams,
    GetEventsFilters,
    IIndexerClient,
} from "@grants-stack-indexer/indexer-client";
import { AnyIndexerFetchedEvent } from "@grants-stack-indexer/shared";

import { IEventsFetcher } from "./interfaces/index.js";

export class EventsFetcher implements IEventsFetcher {
    constructor(private indexerClient: IIndexerClient) {}
    /* @inheritdoc */
    async fetchEventsByBlockNumberAndLogIndex({
        chainId,
        blockNumber,
        logIndex,
        limit = 100,
        allowPartialLastBlock = true,
    }: GetEventsAfterBlockNumberAndLogIndexParams): Promise<AnyIndexerFetchedEvent[]> {
        return await this.indexerClient.getEventsAfterBlockNumberAndLogIndex({
            chainId,
            blockNumber,
            logIndex,
            limit,
            allowPartialLastBlock,
        });
    }

    /** @inheritdoc */
    async fetchEvents(params: GetEventsFilters): Promise<AnyIndexerFetchedEvent[]> {
        return this.indexerClient.getEvents(params);
    }
}
