import { Kysely } from "kysely";

import { TimestampMs, TokenCode, TokenPrice } from "@grants-stack-indexer/shared";

import { Database, handlePostgresError, ICache } from "../../internal.js";

export type PriceCacheKey = { tokenCode: TokenCode; timestampMs: TimestampMs };
export interface IPricingCache extends ICache<PriceCacheKey, TokenPrice> {
    /**
     * Get the prices for a given token and time range.
     * @param tokenCode - The code of the token.
     * @param startTimestampMs - The start timestamp.
     * @param endTimestampMs - The end timestamp.
     * @returns The prices for the given token and time range.
     */
    getPricesByTimeRange(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs: TimestampMs,
    ): Promise<TokenPrice[]>;
}
/**
 * A cache for token prices using Kysely.
 * This cache is used to store and retrieve token prices for a given token and timestamp.
 * It uses the `priceCache` table in the database to store the prices.
 * Note: no eviction strategy is implemented since is not needed for the current use case.
 */
export class KyselyPricingCache implements IPricingCache {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schema: string,
    ) {}

    /** @inheritdoc */
    async get(key: {
        tokenCode: TokenCode;
        timestampMs: TimestampMs;
    }): Promise<TokenPrice | undefined> {
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
                timestampMs: result.timestampMs as TimestampMs,
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

    async getPricesByTimeRange(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs: TimestampMs,
    ): Promise<TokenPrice[]> {
        try {
            const result = await this.db
                .withSchema(this.schema)
                .selectFrom("priceCache")
                .select(["timestampMs", "priceUsd"])
                .where("tokenCode", "=", tokenCode)
                .where("timestampMs", ">=", startTimestampMs)
                .where("timestampMs", "<=", endTimestampMs)
                .execute();

            return result.map((row) => ({
                timestampMs: row.timestampMs as TimestampMs,
                priceUsd: row.priceUsd,
            }));
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyPricingCache.name,
                methodName: "getPricesByTimeRange",
                additionalData: {
                    tokenCode,
                    startTimestampMs,
                    endTimestampMs,
                },
            });
        }
    }

    /** @inheritdoc */
    async set(
        key: { tokenCode: TokenCode; timestampMs: TimestampMs },
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
