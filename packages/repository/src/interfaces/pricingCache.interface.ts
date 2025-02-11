import { TimestampMs, TokenCode, TokenPrice } from "@grants-stack-indexer/shared";

import { ICache } from "./cache.interface.js";

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
