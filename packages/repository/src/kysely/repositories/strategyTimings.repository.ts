import { Kysely } from "kysely";

import { stringify } from "@grants-stack-indexer/shared";

import {
    Database,
    handlePostgresError,
    ICache,
    KyselyMetadataCache,
    StrategyTimings,
} from "../../internal.js";

export class KyselyStrategyTimingsCache implements ICache<string> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schema: string,
    ) {}

    /** @inheritdoc */
    async get(address: string): Promise<StrategyTimings | undefined> {
        try {
            const result = await this.db
                .withSchema(this.schema)
                .selectFrom("strategyTimings")
                .selectAll()
                .where("address", "=", address)
                .executeTakeFirst();

            if (!result) {
                return undefined;
            }
            return result;
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyMetadataCache.name,
                methodName: "get",
                additionalData: {
                    address,
                },
            });
        }
    }

    /** @inheritdoc */
    async set(address: string, strategyTimings: StrategyTimings): Promise<void> {
        try {
            const formattedTimings = strategyTimings.timings
                ? stringify(strategyTimings.timings)
                : strategyTimings.timings;
            await this.db
                .withSchema(this.schema)
                .insertInto("strategyTimings")
                .values({
                    address: address,
                    strategyId: strategyTimings.strategyId,
                    timings: formattedTimings,
                    createdAt: new Date(),
                })
                .onConflict((oc) =>
                    oc.column("address").doUpdateSet({
                        timings: formattedTimings,
                        createdAt: new Date(),
                    }),
                )
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyMetadataCache.name,
                methodName: "set",
                additionalData: {
                    address,
                    strategyId: strategyTimings.strategyId,
                    timings: strategyTimings.timings,
                },
            });
        }
    }

    /** @inheritdoc */
    async clearAll(): Promise<void> {
        // No-op since we don't want to clear the cache
    }
}
