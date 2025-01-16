import { TokenPrice } from "@grants-stack-indexer/shared";

import { ICache, PriceCacheKey } from "../../internal.js";

/**
 * A cache for token prices using a simple in-memory map.
 * This cache is used to store and retrieve token prices for a given token and timestamp.
 */
export class InMemoryPricingCache implements ICache<PriceCacheKey, TokenPrice> {
    private readonly cache: Map<string, TokenPrice> = new Map();

    /** @inheritdoc */
    async get(key: PriceCacheKey): Promise<TokenPrice | undefined> {
        const { tokenCode, timestampMs } = key;

        const keyString = `${tokenCode}-${timestampMs}`;

        const result = this.cache.get(keyString);

        if (!result) {
            return undefined;
        }

        return result;
    }

    /** @inheritdoc */
    async set(key: PriceCacheKey, value: TokenPrice): Promise<void> {
        const { tokenCode, timestampMs } = key;

        const keyString = `${tokenCode}-${timestampMs}`;

        this.cache.set(keyString, value);
    }

    /** @inheritdoc */
    async clearAll(): Promise<void> {
        this.cache.clear();
    }
}
