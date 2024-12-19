import { Kysely } from "kysely";

import { Address, ChainId } from "@grants-stack-indexer/shared";

import { IStrategyRegistryRepository } from "../../interfaces/index.js";
import { Database, Strategy } from "../../internal.js";

export class KyselyStrategyRegistryRepository implements IStrategyRegistryRepository {
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
            .selectFrom("strategiesRegistry")
            .where("chainId", "=", chainId)
            .where("address", "=", strategyAddress)
            .selectAll()
            .executeTakeFirst();
    }

    /** @inheritdoc */
    async saveStrategy(strategy: Strategy): Promise<void> {
        await this.db
            .withSchema(this.schemaName)
            .insertInto("strategiesRegistry")
            .values(strategy)
            .onConflict((oc) => oc.columns(["chainId", "address"]).doUpdateSet(strategy))
            .execute();
    }

    /** @inheritdoc */
    async getStrategies(filters?: { handled?: boolean; chainId?: ChainId }): Promise<Strategy[]> {
        const query = this.db.withSchema(this.schemaName).selectFrom("strategiesRegistry");

        if (filters?.chainId) {
            query.where("chainId", "=", filters.chainId);
        }

        if (filters?.handled) {
            query.where("handled", "=", filters.handled);
        }

        return query.selectAll().execute();
    }
}
