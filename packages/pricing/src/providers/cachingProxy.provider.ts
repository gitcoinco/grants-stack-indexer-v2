import { ICache, PriceCacheKey } from "@grants-stack-indexer/repository";
import { ICacheable, ILogger, TokenCode } from "@grants-stack-indexer/shared";

import { IPricingProvider, TokenPrice } from "../internal.js";

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
        startTimestampMs: number,
        endTimestampMs?: number,
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
            try {
                await this.cache.set(
                    {
                        tokenCode,
                        timestampMs: startTimestampMs,
                    },
                    price,
                );
            } catch (error) {
                this.logger.debug(
                    `Failed to cache price for token ${tokenCode} at ${startTimestampMs}`,
                    { error },
                );
            }
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
}
