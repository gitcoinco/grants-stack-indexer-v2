import { describe, expect, it } from "vitest";

import { ILogger } from "@grants-stack-indexer/shared";

import { MetadataProviderFactory } from "../../src/factory/index.js";
import {
    InvalidMetadataSourceException,
    MetadataConfig,
    MissingDependenciesException,
} from "../../src/internal.js";
import { DummyMetadataProvider } from "../../src/providers/dummy.provider.js";
import { PublicGatewayProvider } from "../../src/providers/publicGateway.provider.js";

describe("MetadataProviderFactory", () => {
    it("creates a DummyMetadataProvider", () => {
        const options: MetadataConfig<"dummy"> = {
            metadataSource: "dummy",
        };

        const metadataProvider = MetadataProviderFactory.create(options);
        expect(metadataProvider).toBeInstanceOf(DummyMetadataProvider);
    });

    it("creates a PublicGatewayProvider", () => {
        const options: MetadataConfig<"public-gateway"> = {
            metadataSource: "public-gateway",
            gateways: ["https://gateway.ipfs.io"],
        };

        const metadataProvider = MetadataProviderFactory.create(options, {
            logger: {} as ILogger,
        });
        expect(metadataProvider).toBeInstanceOf(PublicGatewayProvider);
    });

    it("throws if logger instance is not provided for PublicGatewayProvider", () => {
        const options: MetadataConfig<"public-gateway"> = {
            metadataSource: "public-gateway",
            gateways: ["https://gateway.ipfs.io"],
        };

        expect(() => MetadataProviderFactory.create(options)).toThrowError(
            MissingDependenciesException,
        );
    });

    it("throws an error for invalid metadata source", () => {
        const options = {
            metadataSource: "invalid",
        } as unknown as MetadataConfig<"dummy">;

        expect(() => {
            MetadataProviderFactory.create(options);
        }).toThrowError(InvalidMetadataSourceException);
    });
});
