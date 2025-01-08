import { Kysely } from "kysely";

import { TokenCode, TokenPrice } from "@grants-stack-indexer/shared";

import { Database, handlePostgresError, ICache } from "../../internal.js";

export type PriceCacheKey = { tokenCode: TokenCode; timestampMs: number };

export class KyselyPricingCache implements ICache<PriceCacheKey, TokenPrice> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schema: string,
    ) {}

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
}
