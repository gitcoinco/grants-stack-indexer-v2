import { ICache, PriceCacheKey } from "@grants-stack-indexer/repository";
import { ICacheable, ILogger, TimestampMs, TokenCode } from "@grants-stack-indexer/shared";

import { IPricingProvider, TokenPrice } from "../internal.js";

type CacheResult = {
    timestampMs: TimestampMs;
    price: TokenPrice | undefined;
};

/**
 * A pricing provider that caches token price lookups from the underlying provider.
 * When a price is requested, it first checks the cache. If found, returns the cached price.
 * If not found in cache, fetches from the underlying provider and caches the result before returning.
 * Cache failures (both reads and writes) are logged but do not prevent the provider from functioning.
 */
export class CachingPricingProvider implements IPricingProvider, ICacheable {
    constructor(
        private readonly provider: IPricingProvider,
        private readonly cache: ICache<PriceCacheKey, TokenPrice> & Partial<ICacheable>,
        private readonly logger: ILogger,
    ) {}

    /** @inheritdoc */
    async getTokenPrice(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs?: TimestampMs,
    ): Promise<TokenPrice | undefined> {
        let cachedPrice: TokenPrice | undefined = undefined;
        try {
            cachedPrice = await this.cache.get({
                tokenCode,
                timestampMs: startTimestampMs,
            });
        } catch (error) {
            this.logger.debug(
                `Failed to get cached price for token ${tokenCode} at ${startTimestampMs}`,
                { error },
            );
        }

        if (cachedPrice) {
            return cachedPrice;
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

        const cachedPrices = await this.getCachedPrices(tokenCode, timestamps);
        const timestampsToFetch = this.getTimestampsToFetch(timestamps, cachedPrices);

        if (timestampsToFetch.length === 0) {
            return cachedPrices
                .filter(
                    (result): result is PromiseFulfilledResult<CacheResult> =>
                        result.status === "fulfilled" && !!result.value.price,
                )
                .map((result) => result.value.price)
                .filter((price): price is TokenPrice => !!price);
        }

        const fetchedPrices = await this.provider.getTokenPrices(tokenCode, timestampsToFetch);
        const sortedFetchedPrices = [...fetchedPrices].sort(
            (a, b) => a.timestampMs - b.timestampMs,
        );

        const closestPrices = this.getClosestPricesWithCache(
            tokenCode,
            timestampsToFetch,
            sortedFetchedPrices,
        );

        const priceMap = this.buildPriceMap(cachedPrices, closestPrices);

        return timestamps
            .map((timestampMs) => priceMap.get(timestampMs))
            .filter((price): price is TokenPrice => !!price);
    }

    /**
     * Fetches cached prices for the given token and timestamps.
     * @param tokenCode - The token code
     * @param timestamps - The timestamps
     * @returns {PromiseSettledResult<CacheResult>[]} - The cached prices
     */
    private async getCachedPrices(
        tokenCode: TokenCode,
        timestamps: TimestampMs[],
    ): Promise<PromiseSettledResult<CacheResult>[]> {
        return Promise.allSettled(
            timestamps.map(async (timestampMs) => {
                try {
                    return {
                        timestampMs,
                        price: await this.cache.get({ tokenCode, timestampMs }),
                    };
                } catch (error) {
                    this.logger.debug(
                        `Failed to get cached price for token ${tokenCode} at ${timestampMs}`,
                        { error },
                    );
                    return { timestampMs, price: undefined };
                }
            }),
        );
    }

    /**
     * Gets the timestamps that need to be fetched from the provider.
     * @param timestamps - The timestamps
     * @param cachedPrices - The cached prices PromiseSettledResult
     * @returns The timestamps that need to be fetched
     */
    private getTimestampsToFetch(
        timestamps: TimestampMs[],
        cachedPrices: PromiseSettledResult<CacheResult>[],
    ): TimestampMs[] {
        return timestamps.filter((_, index) => {
            const result = cachedPrices[index];
            if (!result || result.status === "rejected") return true;
            return !result.value.price;
        });
    }

    /**
     * Gets the closest price from the fetched prices. Updates the cache accordingly.
     * @param tokenCode - The token code
     * @param timestampsToFetch - The timestamps that need to be fetched
     * @param sortedFetchedPrices - The sorted fetched prices
     * @returns The closest prices
     */
    private getClosestPricesWithCache(
        tokenCode: TokenCode,
        timestampsToFetch: TimestampMs[],
        sortedFetchedPrices: TokenPrice[],
    ): TokenPrice[] {
        return timestampsToFetch
            .map((timestampMs) => {
                const closestPrice = this.findClosestPrice(sortedFetchedPrices, timestampMs);
                if (!closestPrice) return null;

                const price = {
                    timestampMs,
                    priceUsd: closestPrice.priceUsd,
                };

                // Fire and forget cache operation
                this.cache.set({ tokenCode, timestampMs }, price).catch((error) => {
                    this.logger.debug(
                        `Failed to cache price for token ${tokenCode} at ${timestampMs}`,
                        {
                            error,
                        },
                    );
                });

                return price;
            })
            .filter((price): price is TokenPrice => price !== null);
    }

    /**
     * Builds a price map from cached and fetched prices.
     * @param cachedPrices - The cached prices
     * @param closestPrices - The fetched prices
     * @returns The price map with all prices
     */
    private buildPriceMap(
        cachedPrices: PromiseSettledResult<CacheResult>[],
        closestPrices: TokenPrice[],
    ): Map<number, TokenPrice> {
        const priceMap = new Map<number, TokenPrice>();

        // Add cached prices
        cachedPrices.forEach((result) => {
            if (result.status === "fulfilled" && result.value.price) {
                priceMap.set(result.value.timestampMs, result.value.price);
            }
        });

        // Add closest prices
        closestPrices.forEach((price) => {
            priceMap.set(price.timestampMs, price);
        });

        return priceMap;
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
        if (targetTimestamp >= prices[prices.length - 1]!.timestampMs)
            return prices[prices.length - 1]!;

        // Binary search
        let left = 0;
        let right = prices.length - 1;

        while (left + 1 < right) {
            const mid = Math.floor((left + right) / 2);

            if (prices[mid]!.timestampMs === targetTimestamp) {
                return prices[mid]!;
            }

            if (prices[mid]!.timestampMs < targetTimestamp) {
                left = mid;
            } else {
                right = mid;
            }
        }

        // Return the floor value (largest timestamp <= target)
        return prices[left]!;
    }
}
