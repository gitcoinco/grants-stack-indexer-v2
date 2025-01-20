import { TokenCode } from "@grants-stack-indexer/shared";

import { IPricingProvider, TokenPrice } from "../internal.js";

/**
 * DummyPricingProvider class that implements the IPricingProvider interface.
 * This provider returns a configurable fixed price (defaults to 1) for any token code.
 * Used primarily for testing purposes when actual token prices are not needed.
 */
export class DummyPricingProvider implements IPricingProvider {
    constructor(private readonly dummyPrice: number = 1) {}

    /* @inheritdoc */
    async getTokenPrice(
        _tokenCode: TokenCode,
        startTimestampMs: number,
        _endTimestampMs?: number,
    ): Promise<TokenPrice | undefined> {
        return Promise.resolve({
            priceUsd: this.dummyPrice,
            timestampMs: startTimestampMs,
        });
    }

    /* @inheritdoc */
    async getTokenPrices(_tokenCode: TokenCode, timestamps: number[]): Promise<TokenPrice[]> {
        return timestamps.map((timestampMs) => ({
            priceUsd: this.dummyPrice,
            timestampMs,
        }));
    }
}
