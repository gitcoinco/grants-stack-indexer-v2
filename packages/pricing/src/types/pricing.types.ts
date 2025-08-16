import { Branded, TimestampMs } from "@grants-stack-indexer/shared";

/**
 * @timestampMs - The timestamp in milliseconds
 * @priceUsd - The price in USD
 */
export type TokenPrice = {
    timestampMs: TimestampMs;
    priceUsd: number;
};

export type TimestampISO8601 = Branded<string, "TimestampISO8601">; // yyyy-mm-ddThh:mm:ss.mmmZ
