import { describe, expect, it } from "vitest";

import { ILogger } from "@grants-stack-indexer/shared";

import { CoingeckoProvider, PricingConfig } from "../../src/external.js";
import { PricingProviderFactory } from "../../src/factory/index.js";
import { InvalidPricingSource, MissingDependencies } from "../../src/internal.js";
import { DummyPricingProvider } from "../../src/providers/dummy.provider.js";

describe("PricingProviderFactory", () => {
    it("create a DummyPricingProvider", () => {
        const options: PricingConfig<"dummy"> = {
            pricingSource: "dummy",
            dummyPrice: 1,
        };

        const pricingProvider = PricingProviderFactory.create(options);
        expect(pricingProvider).toBeInstanceOf(DummyPricingProvider);
        const dummyProvider = pricingProvider as DummyPricingProvider;
        expect(dummyProvider["dummyPrice"]).toBe(1);
    });

    it("create a CoingeckoProvider", () => {
        const options: PricingConfig<"coingecko"> = {
            pricingSource: "coingecko",
            apiKey: "some-api-key",
            apiType: "pro",
        };

        const pricingProvider = PricingProviderFactory.create(options, {
            logger: {} as unknown as ILogger,
        });

        expect(pricingProvider).toBeInstanceOf(CoingeckoProvider);
    });

    it("throws if logger instance is not provided for CoingeckoProvider", () => {
        const options: PricingConfig<"coingecko"> = {
            pricingSource: "coingecko",
            apiKey: "some-api-key",
            apiType: "demo",
        };

        expect(() => PricingProviderFactory.create(options)).toThrowError(MissingDependencies);
    });

    it("should throw an error for invalid pricing source", () => {
        const options = {
            source: "invalid",
        };

        expect(() => {
            PricingProviderFactory.create(options as unknown as PricingConfig<"dummy">);
        }).toThrowError(InvalidPricingSource);
    });
});
