import { TimestampMs } from "@grants-stack-indexer/shared";

/**
 * @timestampMs - The timestamp in milliseconds
 * @priceUsd - The price in USD
 */
export type TokenPrice = {
    timestampMs: TimestampMs;
    priceUsd: number;
};
