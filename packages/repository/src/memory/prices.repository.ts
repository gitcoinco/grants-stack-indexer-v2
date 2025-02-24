import { TimestampMs, TokenCode, TokenPrice } from "@grants-stack-indexer/shared";

import { IPricingCache, PriceCacheKey } from "../internal.js";

/**
 * A cache for token prices using a simple in-memory map.
 * This cache is used to store and retrieve token prices for a given token and timestamp.
 */
export class InMemoryPricingCache implements IPricingCache {
    private readonly cache: Map<string, Map<TimestampMs, TokenPrice>> = new Map();

    /** @inheritdoc */
    async get(key: PriceCacheKey): Promise<TokenPrice | undefined> {
        const { tokenCode, timestampMs } = key;

        const keyString = `${tokenCode}`;

        const result = this.cache.get(keyString)?.get(timestampMs);

        return result;
    }

    /** @inheritdoc */
    async set(key: PriceCacheKey, value: TokenPrice): Promise<void> {
        const { tokenCode, timestampMs } = key;

        const keyString = `${tokenCode}`;

        this.cache.get(keyString)?.set(timestampMs, value);
    }

    /** @inheritdoc */
    async getPricesByTimeRange(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs: TimestampMs,
    ): Promise<TokenPrice[]> {
        const keyString = `${tokenCode}`;

        const result = Array.from(this.cache.get(keyString)?.values() ?? []);

        return result.filter(
            (price) => price.timestampMs >= startTimestampMs && price.timestampMs <= endTimestampMs,
        );
    }

    /** @inheritdoc */
    async clearAll(): Promise<void> {
        this.cache.clear();
    }
}
