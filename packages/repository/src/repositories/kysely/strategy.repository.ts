import { Kysely } from "kysely";

import { Address, ChainId } from "@grants-stack-indexer/shared";

import { IStrategyRepository } from "../../interfaces/index.js";
import { Database, Strategy } from "../../internal.js";

export class KyselyStrategyRepository implements IStrategyRepository {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async getStrategyByChainIdAndAddress(
        chainId: ChainId,
        strategyAddress: Address,
    ): Promise<Strategy | undefined> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("strategies")
            .where("chainId", "=", chainId)
            .where("address", "=", strategyAddress)
            .selectAll()
            .executeTakeFirst();
    }

    /** @inheritdoc */
    async saveStrategy(strategy: Strategy): Promise<void> {
        await this.db
            .withSchema(this.schemaName)
            .insertInto("strategies")
            .values(strategy)
            .onConflict((oc) => oc.columns(["chainId", "address"]).doUpdateSet(strategy))
            .execute();
    }

    async getStrategies(params?: { handled?: boolean; chainId?: ChainId }): Promise<Strategy[]> {
        const query = this.db.withSchema(this.schemaName).selectFrom("strategies");

        if (params?.chainId) {
            query.where("chainId", "=", params.chainId);
        }

        if (params?.handled) {
            query.where("handled", "=", params.handled);
        }

        return query.selectAll().execute();
    }
}
