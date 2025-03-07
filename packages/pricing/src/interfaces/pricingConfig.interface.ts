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

export type CoinPaprikaPricingConfig = {
    pricingSource: "coinpaprika";
    apiKey: string;
    apiType: "free" | "starter" | "pro" | "business" | "enterprise";
};

export type PricingConfig<Source extends PricingProvider> = Source extends "dummy"
    ? DummyPricingConfig
    : Source extends "coingecko"
      ? CoingeckoPricingConfig
      : Source extends "coinpaprika"
        ? CoinPaprikaPricingConfig
        : never;
