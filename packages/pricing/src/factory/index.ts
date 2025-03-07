import { ILogger } from "@grants-stack-indexer/shared";

import {
    CoingeckoProvider,
    CoinPaprikaProvider,
    DummyPricingProvider,
    InvalidPricingSource,
    IPricingProvider,
    MissingDependencies,
    PricingConfig,
    PricingProvider,
} from "../internal.js";

/**
 * Factory class for creating pricing providers.
 */
export class PricingProviderFactory {
    /**
     * Creates a pricing provider based on the provided configuration.
     * @param options - The pricing configuration.
     * @param deps - dependencies to inject into the pricing provider.
     * @returns The created pricing provider.
     * @throws {InvalidPricingSource} if the pricing source is invalid.
     * @throws {MissingDependencies} if the dependencies are missing.
     */
    static create(
        options: PricingConfig<PricingProvider>,
        deps?: {
            logger?: ILogger;
        },
    ): IPricingProvider {
        let pricingProvider: IPricingProvider;

        switch (options.pricingSource) {
            case "dummy":
                pricingProvider = new DummyPricingProvider(options.dummyPrice);
                break;
            case "coingecko":
                if (!deps?.logger) {
                    throw new MissingDependencies();
                }

                pricingProvider = new CoingeckoProvider(
                    {
                        apiKey: options.apiKey,
                        apiType: options.apiType,
                    },
                    deps.logger,
                );
                break;
            case "coinpaprika":
                if (!deps?.logger) {
                    throw new MissingDependencies();
                }

                pricingProvider = new CoinPaprikaProvider(
                    {
                        apiKey: options.apiKey,
                        apiType: options.apiType,
                    },
                    deps.logger,
                );
                break;
            default:
                throw new InvalidPricingSource();
        }

        return pricingProvider;
    }
}
