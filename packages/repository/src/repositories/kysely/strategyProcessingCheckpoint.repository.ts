import { Kysely } from "kysely";

import { ChainId, Hex } from "@grants-stack-indexer/shared";

import {
    Database,
    IStrategyProcessingCheckpointRepository,
    NewStrategyProcessingCheckpoint,
    StrategyProcessingCheckpoint,
} from "../../internal.js";

export class KyselyStrategyProcessingCheckpointRepository
    implements IStrategyProcessingCheckpointRepository
{
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async getCheckpoint(
        chainId: ChainId,
        strategyId: Hex,
    ): Promise<StrategyProcessingCheckpoint | undefined> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("strategyProcessingCheckpoints")
            .where("chainId", "=", chainId)
            .where("strategyId", "=", strategyId)
            .selectAll()
            .executeTakeFirst();
    }

    /** @inheritdoc */
    async upsertCheckpoint(checkpoint: NewStrategyProcessingCheckpoint): Promise<void> {
        await this.db
            .withSchema(this.schemaName)
            .insertInto("strategyProcessingCheckpoints")
            .values({
                ...checkpoint,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .onConflict((oc) =>
                oc.columns(["chainId", "strategyId"]).doUpdateSet({
                    lastProcessedBlockNumber: checkpoint.lastProcessedBlockNumber,
                    lastProcessedLogIndex: checkpoint.lastProcessedLogIndex,
                    updatedAt: new Date(),
                }),
            )
            .execute();
    }

    /** @inheritdoc */
    async deleteCheckpoint(chainId: ChainId, strategyId: Hex): Promise<void> {
        await this.db
            .withSchema(this.schemaName)
            .deleteFrom("strategyProcessingCheckpoints")
            .where("chainId", "=", chainId)
            .where("strategyId", "=", strategyId)
            .execute();
    }
}
