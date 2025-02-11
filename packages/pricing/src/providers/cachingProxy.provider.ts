import { IPricingCache } from "@grants-stack-indexer/repository";
import { ICacheable, ILogger, TimestampMs, TokenCode } from "@grants-stack-indexer/shared";

import {
    IPricingProvider,
    MIN_GRANULARITY_MS,
    NoClosePriceFound,
    PROXIMITY_FACTOR,
    TokenPrice,
} from "../internal.js";

/**
 * A pricing provider that caches token price lookups from the underlying provider.
 * When a price is requested, it first checks the cache. If found, returns the cached price.
 * If not found in cache, fetches from the underlying provider and caches the result before returning.
 * Cache failures (both reads and writes) are logged but do not prevent the provider from functioning.
 */
export class CachingPricingProvider implements IPricingProvider, ICacheable {
    constructor(
        private readonly provider: IPricingProvider,
        private readonly cache: Partial<ICacheable> & IPricingCache,
        private readonly logger: ILogger,
    ) {}

    /** @inheritdoc */
    async getTokenPrice(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs?: TimestampMs,
    ): Promise<TokenPrice | undefined> {
        let cachedPrices: TokenPrice[] = [];

        try {
            cachedPrices = (
                await this.cache.getPricesByTimeRange(
                    tokenCode,
                    ((startTimestampMs as number) -
                        MIN_GRANULARITY_MS * PROXIMITY_FACTOR) as TimestampMs,
                    startTimestampMs,
                )
            ).sort((a, b) => a.timestampMs - b.timestampMs);
        } catch (error) {
            this.logger.debug(
                `Failed to get cached prices for token ${tokenCode} at ${startTimestampMs}`,
                { error },
            );
        }

        if (cachedPrices.length > 0) {
            return this.getClosestPrices([startTimestampMs], cachedPrices)[0];
        }

        const price = await this.provider.getTokenPrice(
            tokenCode,
            startTimestampMs,
            endTimestampMs,
        );

        if (price) {
            // we don't await this, because it's not critical
            this.cache
                .set(
                    {
                        tokenCode,
                        timestampMs: startTimestampMs,
                    },
                    price,
                )
                .catch((error) => {
                    this.logger.debug(
                        `Failed to cache price for token ${tokenCode} at ${startTimestampMs}`,
                        { error },
                    );
                });
        }

        return price;
    }

    /** @inheritdoc */
    async clearCache(): Promise<void> {
        try {
            await this.cache.clearCache?.();
        } catch (error) {
            this.logger.debug(`Failed to clear pricing cache`, {
                error,
            });
        }
    }

    /* @inheritdoc */
    /**
     * Note: it caches the closest prices to the requested timestamps.
     * Uses binary search to find the closest price for each requested timestamp.
     */
    async getTokenPrices(tokenCode: TokenCode, timestamps: TimestampMs[]): Promise<TokenPrice[]> {
        if (timestamps.length === 0) return [];
        const fromTimestampMs = timestamps[0] as TimestampMs;
        const toTimestampMs = timestamps[timestamps.length - 1] as TimestampMs;
        const cachedPrices = (
            await this.getCachedPrices(
                tokenCode,
                ((fromTimestampMs as number) - MIN_GRANULARITY_MS) as TimestampMs,
                toTimestampMs,
            )
        ).sort((a, b) => a.timestampMs - b.timestampMs);

        try {
            console.log("Cached prices:", cachedPrices);
            const prices = this.getClosestPrices(timestamps, cachedPrices);
            console.log("Prices:", prices);
            return prices;
        } catch (error) {
            if (error instanceof NoClosePriceFound) {
                console.log("No close price found, fetching from provider");
                const fetchedPrices = await this.provider.getTokenPrices(tokenCode, timestamps);
                console.log("Fetched prices:", fetchedPrices);
                for (const price of fetchedPrices) {
                    this.cache
                        .set(
                            {
                                tokenCode,
                                timestampMs: price.timestampMs,
                            },
                            price,
                        )
                        .catch((error) => {
                            this.logger.debug(
                                `Failed to cache price for token ${tokenCode} at ${price.timestampMs}`,
                                { error },
                            );
                        });
                }
                console.log("Fetched prices antes de closest", fetchedPrices);
                return this.getClosestPrices(timestamps, fetchedPrices).sort(
                    (a, b) => a.timestampMs - b.timestampMs,
                );
            }
            throw error;
        }
    }

    /**
     * Fetches cached prices for the given token and timestamps.
     * @param tokenCode - The token code
     * @param timestamps - The timestamps
     * @returns {PromiseSettledResult<TokenPrice>[]} - The cached prices
     */
    private async getCachedPrices(
        tokenCode: TokenCode,
        fromTimestampMs: TimestampMs,
        toTimestampMs: TimestampMs,
    ): Promise<TokenPrice[]> {
        return this.cache.getPricesByTimeRange(tokenCode, fromTimestampMs, toTimestampMs);
    }

    private getClosestPrices(
        timestampsToFetch: TimestampMs[],
        sortedFetchedPrices: TokenPrice[],
    ): TokenPrice[] {
        return timestampsToFetch.map((timestampMs) => {
            const closestPrice = this.findClosestPrice(sortedFetchedPrices, timestampMs);
            if (!closestPrice) throw new NoClosePriceFound();

            const price = {
                timestampMs,
                priceUsd: closestPrice.priceUsd,
            };
            return price;
        });
    }

    /**
     * Find the closest price using binary search
     * @param prices - Array of prices sorted by timestamp
     * @param targetTimestamp - The timestamp to find closest match for
     * @returns The closest matching price or null if no prices available
     */
    private findClosestPrice(prices: TokenPrice[], targetTimestamp: number): TokenPrice | null {
        if (prices.length === 0) {
            return null;
        }

        // Handle edge cases
        if (targetTimestamp <= prices[0]!.timestampMs) return prices[0]!;
        if (targetTimestamp >= prices[prices.length - 1]!.timestampMs) {
            if (
                Math.abs(prices[prices.length - 1]!.timestampMs - targetTimestamp) >
                MIN_GRANULARITY_MS * PROXIMITY_FACTOR
            ) {
                return null;
            }
            return prices[prices.length - 1]!;
        }

        // Binary search
        let left = 0;
        let right = prices.length - 1;

        while (left + 1 < right) {
            const mid = Math.floor((left + right) / 2);

            if (prices[mid]!.timestampMs === targetTimestamp) {
                if (
                    Math.abs(prices[mid]!.timestampMs - targetTimestamp) >
                    MIN_GRANULARITY_MS * PROXIMITY_FACTOR
                ) {
                    return null;
                }
                return prices[mid]!;
            }

            if (prices[mid]!.timestampMs < targetTimestamp) {
                left = mid;
            } else {
                right = mid;
            }
        }

        // Return the floor value (largest timestamp <= target)
        if (
            Math.abs(prices[left]!.timestampMs - targetTimestamp) >
            MIN_GRANULARITY_MS * PROXIMITY_FACTOR
        ) {
            return null;
        }
        return prices[left]!;
    }
}
