import { Kysely } from "kysely";

import { TokenCode, TokenPrice } from "@grants-stack-indexer/shared";

import { Database, handlePostgresError, ICache } from "../../internal.js";

export type PriceCacheKey = { tokenCode: TokenCode; timestampMs: number };

/**
 * A cache for token prices using Kysely.
 * This cache is used to store and retrieve token prices for a given token and timestamp.
 * It uses the `priceCache` table in the database to store the prices.
 * Note: no eviction strategy is implemented since is not needed for the current use case.
 */
export class KyselyPricingCache implements ICache<PriceCacheKey, TokenPrice> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schema: string,
    ) {}

    /** @inheritdoc */
    async get(key: { tokenCode: TokenCode; timestampMs: number }): Promise<TokenPrice | undefined> {
        const { tokenCode, timestampMs } = key;

        try {
            const result = await this.db
                .withSchema(this.schema)
                .selectFrom("priceCache")
                .select(["timestampMs", "priceUsd"])
                .where("tokenCode", "=", tokenCode)
                .where("timestampMs", "=", timestampMs)
                .executeTakeFirst();

            if (!result) {
                return undefined;
            }

            return {
                timestampMs: result.timestampMs,
                priceUsd: result.priceUsd,
            };
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyPricingCache.name,
                methodName: "get",
                additionalData: {
                    key,
                },
            });
        }
    }

    /** @inheritdoc */
    async set(
        key: { tokenCode: TokenCode; timestampMs: number },
        value: TokenPrice,
    ): Promise<void> {
        const { tokenCode, timestampMs } = key;
        const { priceUsd } = value;

        try {
            await this.db
                .withSchema(this.schema)
                .insertInto("priceCache")
                .values({
                    tokenCode: tokenCode,
                    timestampMs: timestampMs,
                    priceUsd: priceUsd,
                    createdAt: new Date(),
                })
                .onConflict((oc) =>
                    oc.columns(["tokenCode", "timestampMs"]).doUpdateSet({
                        priceUsd: priceUsd,
                        createdAt: new Date(),
                    }),
                )
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyPricingCache.name,
                methodName: "set",
                additionalData: {
                    key,
                    value,
                },
            });
        }
    }

    /** @inheritdoc */
    async clearAll(): Promise<void> {
        // No-op since we don't want to clear the cache
    }
}
