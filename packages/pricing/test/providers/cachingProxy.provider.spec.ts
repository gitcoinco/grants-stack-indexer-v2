import { beforeEach, describe, expect, it, vi } from "vitest";

import { ICache, PriceCacheKey } from "@grants-stack-indexer/repository";
import { ILogger, TokenCode } from "@grants-stack-indexer/shared";

import { IPricingProvider, TokenPrice } from "../../src/internal.js";
import { CachingPricingProvider } from "../../src/providers/cachingProxy.provider.js";

describe("CachingPricingProvider", () => {
    const mockProvider = {
        getTokenPrice: vi.fn(),
    } as unknown as IPricingProvider;

    const mockCache = {
        get: vi.fn(),
        set: vi.fn(),
    } as unknown as ICache<PriceCacheKey, TokenPrice>;

    const mockLogger = {
        debug: vi.fn(),
    } as unknown as ILogger;

    let provider: CachingPricingProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new CachingPricingProvider(mockProvider, mockCache, mockLogger);
    });

    describe("getTokenPrice", () => {
        const testToken = {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            decimals: 6,
        };
        const testStartTime = 1234567890000;
        const testEndTime = 1234567899999;
        const testPrice: TokenPrice = {
            priceUsd: 0.99,
            timestampMs: testStartTime,
        };

        it("returns cached price when available", async () => {
            vi.spyOn(mockCache, "get").mockResolvedValue(testPrice);

            const result = await provider.getTokenPrice(testToken.code, testStartTime);

            expect(result).toEqual(testPrice);
            expect(mockCache.get).toHaveBeenCalledWith({
                tokenCode: testToken.code,
                timestampMs: testStartTime,
            });
            expect(mockProvider.getTokenPrice).not.toHaveBeenCalled();
        });

        it("fetches and caches price when cache misses", async () => {
            vi.spyOn(mockCache, "get").mockResolvedValue(undefined);
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
            vi.spyOn(mockCache, "get").mockRejectedValue(new Error("Cache read error"));
            vi.spyOn(mockProvider, "getTokenPrice").mockResolvedValue(testPrice);

            const result = await provider.getTokenPrice(testToken.code, testStartTime, testEndTime);

            expect(result).toEqual(testPrice);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Failed to get cached price for token ${testToken.code} at ${testStartTime}`,
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
});
