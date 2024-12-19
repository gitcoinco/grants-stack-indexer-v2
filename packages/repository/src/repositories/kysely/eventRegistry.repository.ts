import { Kysely } from "kysely";

import { ChainId } from "@grants-stack-indexer/shared";

import { IEventRegistryRepository } from "../../interfaces/index.js";
import { Database, NewProcessedEvent, ProcessedEvent } from "../../internal.js";

export class KyselyEventRegistryRepository implements IEventRegistryRepository {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async getLastProcessedEvent(chainId: ChainId): Promise<ProcessedEvent | undefined> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("eventsRegistry")
            .where("chainId", "=", chainId)
            .selectAll()
            .executeTakeFirst();
    }

    /** @inheritdoc */
    async saveLastProcessedEvent(chainId: ChainId, event: NewProcessedEvent): Promise<void> {
        const { blockNumber, blockTimestamp, logIndex, rawEvent } = event; // Extract only the fields from NewProcessedEvent
        await this.db
            .withSchema(this.schemaName)
            .insertInto("eventsRegistry")
            .values({ blockNumber, blockTimestamp, logIndex, chainId, rawEvent })
            .onConflict((oc) =>
                oc.columns(["chainId"]).doUpdateSet({
                    blockNumber,
                    blockTimestamp,
                    logIndex,
                    rawEvent,
                    chainId,
                }),
            )
            .execute();
    }
}
