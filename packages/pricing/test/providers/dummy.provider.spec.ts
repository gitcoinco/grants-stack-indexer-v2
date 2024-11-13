import { describe, expect, it } from "vitest";

import { TokenCode } from "@grants-stack-indexer/shared";

import { DummyPricingProvider } from "../../src/providers/dummy.provider.js";

describe("DummyPricingProvider", () => {
    it("return 1 for all token prices", async () => {
        const provider = new DummyPricingProvider();

        const response = await provider.getTokenPrice("ETH" as TokenCode, 11111111);

        expect(response).toEqual({
            priceUsd: 1,
            timestampMs: 11111111,
        });
    });
});
