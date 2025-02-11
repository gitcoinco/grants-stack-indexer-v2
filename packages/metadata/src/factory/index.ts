import { ILogger } from "@grants-stack-indexer/shared";

import { InvalidMetadataSourceException } from "../exceptions/invalidMetadataSource.exception.js";
import { MissingDependenciesException } from "../exceptions/missingDependencies.exception.js";
import {
    IMetadataProvider,
    MetadataConfig,
    MetadataProvider,
    PublicGatewayProvider,
} from "../internal.js";
import { DummyMetadataProvider } from "../providers/dummy.provider.js";

/**
 * Factory class for creating pricing providers.
 */
export class MetadataProviderFactory {
    /**
     * Creates a pricing provider based on the provided configuration.
     * @param options - The pricing configuration.
     * @param deps - dependencies to inject into the pricing provider.
     * @returns The created pricing provider.
     * @throws {InvalidMetadataSource} if the pricing source is invalid.
     * @throws {MissingDependencies} if the dependencies are missing.
     */
    static create(
        options: MetadataConfig<MetadataProvider>,
        deps?: {
            logger?: ILogger;
        },
    ): IMetadataProvider {
        let metadataProvider: IMetadataProvider;

        switch (options.metadataSource) {
            case "dummy":
                metadataProvider = new DummyMetadataProvider();
                break;
            case "public-gateway":
                if (!deps?.logger) {
                    throw new MissingDependenciesException(["logger"]);
                }
                metadataProvider = new PublicGatewayProvider(options.gateways, deps.logger);
                break;
            default:
                throw new InvalidMetadataSourceException();
        }

        return metadataProvider;
    }
}
