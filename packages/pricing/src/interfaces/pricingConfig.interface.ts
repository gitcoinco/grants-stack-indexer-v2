import { PricingProvider } from "./index.js";

export type DummyPricingConfig = {
    pricingSource: "dummy";
    dummyPrice?: number;
};

export type CoingeckoPricingConfig = {
    pricingSource: "coingecko";
    apiKey: string;
    apiType: "demo" | "pro";
};

export type PricingConfig<Source extends PricingProvider> = Source extends "dummy"
    ? DummyPricingConfig
    : Source extends "coingecko"
      ? CoingeckoPricingConfig
      : never;
