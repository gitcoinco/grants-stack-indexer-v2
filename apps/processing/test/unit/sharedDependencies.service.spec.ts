import { describe, expect, it, vi } from "vitest";

import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IpfsProvider } from "@grants-stack-indexer/metadata";
import { PricingProviderFactory } from "@grants-stack-indexer/pricing";
import { createKyselyDatabase } from "@grants-stack-indexer/repository";
import { Logger } from "@grants-stack-indexer/shared";

import type { Environment } from "../../src/config/env.js";
import { SharedDependenciesService } from "../../src/services/sharedDependencies.service.js";

// Mock dependencies
vi.mock("@grants-stack-indexer/repository", () => ({
    createKyselyDatabase: vi.fn(),
    KyselyProjectRepository: vi.fn(),
    KyselyRoundRepository: vi.fn(),
    KyselyApplicationRepository: vi.fn(),
    KyselyDonationRepository: vi.fn(),
    KyselyApplicationPayoutRepository: vi.fn(),
}));

vi.mock("@grants-stack-indexer/pricing", () => ({
    PricingProviderFactory: {
        create: vi.fn(),
    },
}));

vi.mock("@grants-stack-indexer/metadata", () => ({
    IpfsProvider: vi.fn(),
}));

vi.mock("@grants-stack-indexer/indexer-client", () => ({
    EnvioIndexerClient: vi.fn(),
}));

describe("SharedDependenciesService", () => {
    const mockEnv: Pick<
        Environment,
        | "DATABASE_URL"
        | "DATABASE_SCHEMA"
        | "IPFS_GATEWAYS_URL"
        | "INDEXER_GRAPHQL_URL"
        | "INDEXER_ADMIN_SECRET"
        | "PRICING_SOURCE"
    > = {
        DATABASE_URL: "postgresql://localhost:5432/test",
        DATABASE_SCHEMA: "public",
        IPFS_GATEWAYS_URL: ["https://ipfs.io"],
        INDEXER_GRAPHQL_URL: "http://localhost:8080",
        INDEXER_ADMIN_SECRET: "secret",
        PRICING_SOURCE: "dummy",
    };

    it("initializes all dependencies correctly", async () => {
        const dependencies = await SharedDependenciesService.initialize(mockEnv as Environment);

        // Verify database initialization
        expect(createKyselyDatabase).toHaveBeenCalledWith({
            connectionString: mockEnv.DATABASE_URL,
        });

        // Verify providers initialization
        expect(PricingProviderFactory.create).toHaveBeenCalledWith(mockEnv, {
            logger: expect.any(Logger) as Logger,
        });
        expect(IpfsProvider).toHaveBeenCalledWith(mockEnv.IPFS_GATEWAYS_URL, expect.any(Logger));

        // Verify indexer client initialization
        expect(EnvioIndexerClient).toHaveBeenCalledWith(
            mockEnv.INDEXER_GRAPHQL_URL,
            mockEnv.INDEXER_ADMIN_SECRET,
        );

        // Verify structure of returned dependencies
        expect(dependencies).toHaveProperty("core");
        expect(dependencies).toHaveProperty("registries");
        expect(dependencies).toHaveProperty("indexerClient");
        expect(dependencies).toHaveProperty("kyselyDatabase");

        // Verify core dependencies
        expect(dependencies.core).toHaveProperty("projectRepository");
        expect(dependencies.core).toHaveProperty("roundRepository");
        expect(dependencies.core).toHaveProperty("applicationRepository");
        expect(dependencies.core).toHaveProperty("pricingProvider");
        expect(dependencies.core).toHaveProperty("donationRepository");
        expect(dependencies.core).toHaveProperty("metadataProvider");
        expect(dependencies.core).toHaveProperty("applicationPayoutRepository");

        // Verify registries
        expect(dependencies.registries).toHaveProperty("eventsRegistry");
        expect(dependencies.registries).toHaveProperty("strategyRegistry");
    });
});
