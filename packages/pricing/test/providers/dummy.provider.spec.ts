import { describe, expect, it } from "vitest";

import { TimestampMs, TokenCode } from "@grants-stack-indexer/shared";

import { DummyPricingProvider } from "../../src/providers/dummy.provider.js";

describe("DummyPricingProvider", () => {
    it("return 1 for all token prices", async () => {
        const provider = new DummyPricingProvider();

        const response = await provider.getTokenPrice("ETH" as TokenCode, 11111111 as TimestampMs);

        expect(response).toEqual({
            priceUsd: 1,
            timestampMs: 11111111,
        });
    });

    describe("getTokenPrices", () => {
        it("returns dummy prices for all timestamps", async () => {
            const provider = new DummyPricingProvider(1);
            const timestamps = [1000, 2000, 3000] as TimestampMs[];

            const result = await provider.getTokenPrices("ETH" as TokenCode, timestamps);
            expect(result).toEqual(
                timestamps.map((ts) => ({
                    timestampMs: ts,
                    priceUsd: 1,
                })),
            );
        });

        it("handles empty timestamps array", async () => {
            const provider = new DummyPricingProvider();
            const result = await provider.getTokenPrices("ETH" as TokenCode, []);
            expect(result).toEqual([]);
        });
    });
});
