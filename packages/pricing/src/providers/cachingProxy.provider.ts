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
    ) {
        this.logger.debug("Initializing CachingPricingProvider", {
            className: "CachingPricingProvider",
            providerType: provider.constructor.name,
        });
    }

    /** @inheritdoc */
    async getTokenPrice(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs?: TimestampMs,
    ): Promise<TokenPrice | undefined> {
        this.logger.debug("Getting token price", {
            className: "CachingPricingProvider",
            methodName: "getTokenPrice",
            tokenCode,
            startTimestamp: new Date(startTimestampMs).toISOString(),
            endTimestamp: endTimestampMs ? new Date(endTimestampMs).toISOString() : undefined,
        });

        let cachedPrices: TokenPrice[] = [];
        const cacheStartTime = (startTimestampMs as number) - MIN_GRANULARITY_MS * PROXIMITY_FACTOR;

        try {
            this.logger.debug("Checking cache for prices", {
                className: "CachingPricingProvider",
                methodName: "getTokenPrice",
                tokenCode,
                cacheTimeRange: {
                    start: new Date(cacheStartTime).toISOString(),
                    end: new Date(startTimestampMs).toISOString(),
                },
            });

            cachedPrices = (
                await this.cache.getPricesByTimeRange(
                    tokenCode,
                    cacheStartTime as TimestampMs,
                    startTimestampMs,
                )
            ).sort((a, b) => a.timestampMs - b.timestampMs);

            this.logger.debug("Cache lookup result", {
                className: "CachingPricingProvider",
                methodName: "getTokenPrice",
                tokenCode,
                cachedPricesCount: cachedPrices.length,
            });
        } catch (error) {
            this.logger.warn("Cache lookup failed", {
                className: "CachingPricingProvider",
                methodName: "getTokenPrice",
                tokenCode,
                timestamp: new Date(startTimestampMs).toISOString(),
                error: error instanceof Error ? error.message : String(error),
            });
        }

        if (cachedPrices.length > 0) {
            const closestPrice = this.getClosestPrices([startTimestampMs], cachedPrices)[0];
            if (!closestPrice) {
                this.logger.warn("No closest price found in cache", {
                    className: "CachingPricingProvider",
                    methodName: "getTokenPrice",
                    tokenCode,
                    requestedTimestamp: new Date(startTimestampMs).toISOString(),
                });
                return undefined;
            }
            this.logger.debug("Returning cached price", {
                className: "CachingPricingProvider",
                methodName: "getTokenPrice",
                tokenCode,
                requestedTimestamp: new Date(startTimestampMs).toISOString(),
                priceTimestamp: new Date(closestPrice.timestampMs).toISOString(),
                price: closestPrice.priceUsd,
            });
            return closestPrice;
        }

        this.logger.info("Cache miss, fetching from provider", {
            className: "CachingPricingProvider",
            methodName: "getTokenPrice",
            tokenCode,
            startTimestamp: new Date(startTimestampMs).toISOString(),
        });

        const price = await this.provider.getTokenPrice(
            tokenCode,
            startTimestampMs,
            endTimestampMs,
        );

        if (price) {
            this.logger.debug("Caching fetched price", {
                className: "CachingPricingProvider",
                methodName: "getTokenPrice",
                tokenCode,
                timestamp: new Date(price.timestampMs).toISOString(),
                price: price.priceUsd,
            });

            this.cache.set({ tokenCode, timestampMs: startTimestampMs }, price).catch((error) => {
                this.logger.warn("Failed to cache price", {
                    className: "CachingPricingProvider",
                    methodName: "getTokenPrice",
                    tokenCode,
                    timestamp: new Date(startTimestampMs).toISOString(),
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        } else {
            this.logger.warn("No price returned from provider", {
                className: "CachingPricingProvider",
                methodName: "getTokenPrice",
                tokenCode,
                startTimestamp: new Date(startTimestampMs).toISOString(),
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
        this.logger.info("Getting token prices", {
            className: "CachingPricingProvider",
            methodName: "getTokenPrices",
            tokenCode,
            timestampCount: timestamps.length,
            timeRange:
                timestamps.length > 0
                    ? {
                          start: new Date(Math.min(...timestamps)).toISOString(),
                          end: new Date(Math.max(...timestamps)).toISOString(),
                      }
                    : undefined,
        });

        if (timestamps.length === 0) return [];

        const sortedTimestamps = timestamps.sort((a, b) => a - b);
        const fromTimestampMs = sortedTimestamps[0] as TimestampMs;
        const toTimestampMs = sortedTimestamps[sortedTimestamps.length - 1] as TimestampMs;

        this.logger.debug("Fetching cached prices", {
            className: "CachingPricingProvider",
            methodName: "getTokenPrices",
            tokenCode,
            timeRange: {
                start: new Date(fromTimestampMs).toISOString(),
                end: new Date(toTimestampMs).toISOString(),
            },
        });

        const cachedPrices = (
            await this.getCachedPrices(
                tokenCode,
                ((fromTimestampMs as number) - MIN_GRANULARITY_MS) as TimestampMs,
                toTimestampMs,
            )
        ).sort((a, b) => a.timestampMs - b.timestampMs);

        this.logger.debug("Cache lookup result", {
            className: "CachingPricingProvider",
            methodName: "getTokenPrices",
            tokenCode,
            cachedPricesCount: cachedPrices.length,
        });

        try {
            const prices = this.getClosestPrices(sortedTimestamps, cachedPrices);
            this.logger.info("Successfully matched cached prices", {
                className: "CachingPricingProvider",
                methodName: "getTokenPrices",
                tokenCode,
                requestedCount: timestamps.length,
                matchedCount: prices.length,
            });
            return prices;
        } catch (error) {
            if (error instanceof NoClosePriceFound) {
                this.logger.info("No close prices found in cache, fetching from provider", {
                    className: "CachingPricingProvider",
                    methodName: "getTokenPrices",
                    tokenCode,
                    timestampCount: sortedTimestamps.length,
                });

                const fetchedPrices = await this.provider.getTokenPrices(
                    tokenCode,
                    sortedTimestamps,
                );

                this.logger.debug("Caching fetched prices", {
                    className: "CachingPricingProvider",
                    methodName: "getTokenPrices",
                    tokenCode,
                    fetchedCount: fetchedPrices.length,
                });

                for (const price of fetchedPrices) {
                    this.cache
                        .set({ tokenCode, timestampMs: price.timestampMs }, price)
                        .catch((error) => {
                            this.logger.warn("Failed to cache price", {
                                className: "CachingPricingProvider",
                                methodName: "getTokenPrices",
                                tokenCode,
                                timestamp: new Date(price.timestampMs).toISOString(),
                                error: error instanceof Error ? error.message : String(error),
                            });
                        });
                }

                const closestPrices = this.getClosestPrices(sortedTimestamps, fetchedPrices);
                this.logger.info("Successfully matched fetched prices", {
                    className: "CachingPricingProvider",
                    methodName: "getTokenPrices",
                    tokenCode,
                    requestedCount: timestamps.length,
                    matchedCount: closestPrices.length,
                });

                return closestPrices.sort((a, b) => a.timestampMs - b.timestampMs);
            }
            this.logger.error("Unexpected error while getting prices", {
                className: "CachingPricingProvider",
                methodName: "getTokenPrices",
                tokenCode,
                error: error instanceof Error ? error.message : String(error),
            });
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
        this.logger.debug("Finding closest price", {
            className: "CachingPricingProvider",
            methodName: "findClosestPrice",
            targetTimestamp: new Date(targetTimestamp).toISOString(),
            availablePrices: prices.length,
        });

        if (prices.length === 0) {
            this.logger.debug("No prices available");
            return null;
        }

        // Handle edge cases with detailed logging
        if (targetTimestamp <= prices[0]!.timestampMs) {
            this.logger.debug("Using first price (target before range)", {
                priceTimestamp: new Date(prices[0]!.timestampMs).toISOString(),
                price: prices[0]!.priceUsd,
            });
            return prices[0]!;
        }

        if (targetTimestamp >= prices[prices.length - 1]!.timestampMs) {
            const timeDiff = Math.abs(prices[prices.length - 1]!.timestampMs - targetTimestamp);
            if (timeDiff > MIN_GRANULARITY_MS * PROXIMITY_FACTOR) {
                this.logger.debug("Last price too far from target", {
                    timeDifference: `${timeDiff / 1000} seconds`,
                });
                return null;
            }
            this.logger.debug("Using last price (target after range)", {
                priceTimestamp: new Date(prices[prices.length - 1]!.timestampMs).toISOString(),
                price: prices[prices.length - 1]!.priceUsd,
            });
            return prices[prices.length - 1]!;
        }

        // Binary search with logging
        let left = 0;
        let right = prices.length - 1;

        while (left + 1 < right) {
            const mid = Math.floor((left + right) / 2);
            this.logger.debug("Binary search iteration", {
                left: new Date(prices[left]!.timestampMs).toISOString(),
                mid: new Date(prices[mid]!.timestampMs).toISOString(),
                right: new Date(prices[right]!.timestampMs).toISOString(),
            });

            if (prices[mid]!.timestampMs === targetTimestamp) {
                const timeDiff = Math.abs(prices[mid]!.timestampMs - targetTimestamp);
                if (timeDiff > MIN_GRANULARITY_MS * PROXIMITY_FACTOR) {
                    this.logger.debug("Exact match found but too far from target", {
                        timeDifference: `${timeDiff / 1000} seconds`,
                    });
                    return null;
                }
                this.logger.debug("Exact match found", {
                    priceTimestamp: new Date(prices[mid]!.timestampMs).toISOString(),
                    price: prices[mid]!.priceUsd,
                });
                return prices[mid]!;
            }

            if (prices[mid]!.timestampMs < targetTimestamp) {
                left = mid;
            } else {
                right = mid;
            }
        }

        const timeDiff = Math.abs(prices[left]!.timestampMs - targetTimestamp);
        if (timeDiff > MIN_GRANULARITY_MS * PROXIMITY_FACTOR) {
            this.logger.debug("Closest price too far from target", {
                timeDifference: `${timeDiff / 1000} seconds`,
            });
            return null;
        }

        this.logger.debug("Found closest price", {
            priceTimestamp: new Date(prices[left]!.timestampMs).toISOString(),
            price: prices[left]!.priceUsd,
            timeDifference: `${timeDiff / 1000} seconds`,
        });
        return prices[left]!;
    }
}
