import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IPricingCache } from "@grants-stack-indexer/repository";
import { ICacheable, ILogger, TimestampMs, TokenCode } from "@grants-stack-indexer/shared";

import {
    IPricingProvider,
    MIN_GRANULARITY_MS,
    NoClosePriceFound,
    PROXIMITY_FACTOR,
    TokenPrice,
} from "../../src/internal.js";
import { CachingPricingProvider } from "../../src/providers/cachingProxy.provider.js";

describe("CachingPricingProvider", () => {
    let mockProvider: IPricingProvider & ICacheable;
    let mockCache: IPricingCache;
    let mockLogger: ILogger;

    let provider: CachingPricingProvider;

    beforeEach(() => {
        mockProvider = {
            getTokenPrice: vi.fn(),
            getTokenPrices: vi.fn(),
            clearCache: vi.fn(),
        } as unknown as IPricingProvider & ICacheable;

        mockCache = {
            get: vi.fn(),
            set: vi.fn().mockImplementation(() => Promise.resolve()),
            getPricesByTimeRange: vi.fn(),
            clearCache: vi.fn(),
        } as unknown as IPricingCache;

        mockLogger = {
            debug: vi.fn(),
            verbose: vi.fn(),
        } as unknown as ILogger;

        provider = new CachingPricingProvider(mockProvider, mockCache, mockLogger);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("getTokenPrice", () => {
        const testToken = {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            decimals: 6,
        };
        const testStartTime = 1234567890000 as TimestampMs;
        const testEndTime = 1234567899999 as TimestampMs;
        const testPrice: TokenPrice = {
            priceUsd: 0.99,
            timestampMs: testStartTime,
        };

        it("returns cached price when available", async () => {
            vi.spyOn(mockCache, "getPricesByTimeRange").mockResolvedValue([testPrice]);

            const result = await provider.getTokenPrice(testToken.code, testStartTime);
            expect(result).toEqual(testPrice);
            expect(mockCache.getPricesByTimeRange).toHaveBeenCalledWith(
                testToken.code,
                testStartTime - MIN_GRANULARITY_MS * PROXIMITY_FACTOR,
                testStartTime,
            );
            expect(mockProvider.getTokenPrice).not.toHaveBeenCalled();
        });

        it("fetches and caches price when cache misses", async () => {
            vi.spyOn(mockCache, "getPricesByTimeRange").mockResolvedValue([]);
            vi.spyOn(mockProvider, "getTokenPrice").mockResolvedValue(testPrice);

            const result = await provider.getTokenPrice(testToken.code, testStartTime, testEndTime);

            expect(result).toEqual(testPrice);
            expect(mockProvider.getTokenPrice).toHaveBeenCalledWith(
                testToken.code,
                testStartTime,
                testEndTime,
            );
            expect(mockCache.set).toHaveBeenCalledWith(
                {
                    tokenCode: testToken.code,
                    timestampMs: testStartTime,
                },
                testPrice,
            );
        });

        it("handles cache read failures gracefully", async () => {
            vi.spyOn(mockCache, "getPricesByTimeRange").mockRejectedValue(
                new Error("Cache read error"),
            );
            vi.spyOn(mockProvider, "getTokenPrice").mockResolvedValue(testPrice);

            const result = await provider.getTokenPrice(testToken.code, testStartTime, testEndTime);

            expect(result).toEqual(testPrice);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Failed to get cached prices for token ${testToken.code} at ${testStartTime}`,
                expect.any(Object),
            );
            expect(mockProvider.getTokenPrice).toHaveBeenCalled();
        });

        it("handles cache write failures gracefully", async () => {
            vi.spyOn(mockCache, "get").mockResolvedValue(undefined);
            vi.spyOn(mockCache, "set").mockRejectedValue(new Error("Cache write error"));
            vi.spyOn(mockProvider, "getTokenPrice").mockResolvedValue(testPrice);

            const result = await provider.getTokenPrice(testToken.code, testStartTime, testEndTime);

            expect(result).toEqual(testPrice);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Failed to cache price for token ${testToken.code} at ${testStartTime}`,
                expect.any(Object),
            );
        });

        it("returns undefined when price is not found", async () => {
            vi.spyOn(mockCache, "get").mockResolvedValue(undefined);
            vi.spyOn(mockProvider, "getTokenPrice").mockResolvedValue(undefined);

            const result = await provider.getTokenPrice(testToken.code, testStartTime, testEndTime);

            expect(result).toBeUndefined();
            expect(mockCache.set).not.toHaveBeenCalled();
        });
    });

    describe("getTokenPrices", () => {
        it("should return an empty array when no timestamps are provided", async () => {
            const result = await provider.getTokenPrices("TOKEN_CODE" as TokenCode, []);
            expect(result).toEqual([]);
        });

        it("should return cached prices when available", async () => {
            const cachedPrices: TokenPrice[] = [
                { timestampMs: 1000 as TimestampMs, priceUsd: 10 },
                { timestampMs: 2000 as TimestampMs, priceUsd: 20 },
            ];
            vi.spyOn(provider, "getCachedPrices" as keyof CachingPricingProvider).mockResolvedValue(
                cachedPrices,
            );

            const result = await provider.getTokenPrices("TOKEN_CODE" as TokenCode, [
                1000 as TimestampMs,
                2000 as TimestampMs,
            ]);
            expect(result).toEqual(cachedPrices);
        });

        it("should fetch prices from the provider when no cached prices are found", async () => {
            const timestamps = [1000, 2000];
            const fetchedPrices: TokenPrice[] = [
                { timestampMs: 1000 as TimestampMs, priceUsd: 10 },
                { timestampMs: 2000 as TimestampMs, priceUsd: 20 },
            ];
            vi.spyOn(provider, "getCachedPrices" as keyof CachingPricingProvider).mockResolvedValue(
                [],
            );
            vi.spyOn(mockProvider, "getTokenPrices").mockResolvedValue(fetchedPrices);

            const result = await provider.getTokenPrices(
                "TOKEN_CODE" as TokenCode,
                timestamps as TimestampMs[],
            );
            expect(result).toEqual(fetchedPrices);
            expect(mockProvider.getTokenPrices).toHaveBeenCalledWith("TOKEN_CODE", timestamps);
        });

        it("should handle NoClosePriceFound error correctly", async () => {
            const timestamps = [1000, 2000];
            vi.spyOn(provider, "getCachedPrices" as keyof CachingPricingProvider).mockResolvedValue(
                [],
            );
            vi.spyOn(mockProvider, "getTokenPrices").mockResolvedValue([
                { timestampMs: 1100 as TimestampMs, priceUsd: 10 },
                { timestampMs: 1500 as TimestampMs, priceUsd: 20 },
            ]);
            vi.spyOn(
                provider,
                "getClosestPrices" as keyof CachingPricingProvider,
            ).mockImplementationOnce(() => {
                throw new NoClosePriceFound();
            });

            const result = await provider.getTokenPrices(
                "TOKEN_CODE" as TokenCode,
                timestamps as TimestampMs[],
            );

            expect(result).toEqual([
                { timestampMs: 1000 as TimestampMs, priceUsd: 10 },
                { timestampMs: 2000 as TimestampMs, priceUsd: 20 },
            ]);
        });

        it("should log an error if fetching prices fails", async () => {
            const timestamps = [1000, 2000];
            vi.spyOn(provider, "getCachedPrices" as keyof CachingPricingProvider).mockResolvedValue(
                [],
            );
            vi.spyOn(mockProvider, "getTokenPrices").mockRejectedValue(new Error("Fetch error"));

            await expect(
                provider.getTokenPrices("TOKEN_CODE" as TokenCode, timestamps as TimestampMs[]),
            ).rejects.toThrow("Fetch error");
        });
    });
});
