import { describe, expect, it, vi } from "vitest";

import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { MetadataProviderFactory, PublicGatewayProvider } from "@grants-stack-indexer/metadata";
import { PricingProviderFactory } from "@grants-stack-indexer/pricing";
import { createKyselyDatabase } from "@grants-stack-indexer/repository";

import type { Environment } from "../../src/config/env.js";
import { SharedDependenciesService } from "../../src/services/sharedDependencies.service.js";

const mocks = vi.hoisted(() => {
    return {
        logger: {
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
        },
    };
});

vi.mock("@grants-stack-indexer/shared", async (importActual) => {
    const actual = await importActual<typeof import("@grants-stack-indexer/shared")>();
    return {
        ...actual,
        Logger: {
            getInstance: vi.fn().mockReturnValue(mocks.logger),
        },
    };
});

// Mock dependencies
vi.mock("@grants-stack-indexer/repository", () => ({
    createKyselyDatabase: vi.fn(),
    KyselyProjectRepository: vi.fn(),
    KyselyRoundRepository: vi.fn(),
    KyselyApplicationRepository: vi.fn(),
    KyselyDonationRepository: vi.fn(),
    KyselyApplicationPayoutRepository: vi.fn(),
    KyselyStrategyRegistryRepository: vi.fn().mockImplementation(() => ({
        getStrategies: vi.fn().mockResolvedValue([]),
        getStrategyId: vi.fn(),
        saveStrategyId: vi.fn(),
    })),
    KyselyEventRegistryRepository: vi.fn(),
    KyselyStrategyProcessingCheckpointRepository: vi.fn(),
    KyselyTransactionManager: vi.fn(),
    KyselyPricingCache: vi.fn(),
    KyselyMetadataCache: vi.fn(),
    InMemoryPricingCache: vi.fn(),
    InMemoryMetadataCache: vi.fn(),
}));

vi.mock("@grants-stack-indexer/pricing", () => ({
    PricingProviderFactory: {
        create: vi.fn(),
    },
    CachingPricingProvider: vi.fn(),
}));

vi.mock("@grants-stack-indexer/metadata", () => ({
    CachingMetadataProvider: vi.fn(),
    MetadataProviderFactory: {
        create: vi.fn(),
    },
}));

vi.mock("@grants-stack-indexer/indexer-client", () => ({
    EnvioIndexerClient: vi.fn(),
}));

vi.mock("@grants-stack-indexer/data-flow", () => {
    const mockStrategyRegistry = {
        getStrategies: vi.fn(),
        getStrategyId: vi.fn(),
        saveStrategyId: vi.fn(),
    };

    const mockEventRegistry = {
        getLastProcessedEvent: vi.fn(),
        saveLastProcessedEvent: vi.fn(),
    };

    return {
        InMemoryCachedStrategyRegistry: {
            initialize: vi.fn().mockResolvedValue(mockStrategyRegistry),
        },
        DatabaseStrategyRegistry: vi.fn().mockImplementation(() => ({
            getStrategies: vi.fn(),
            getStrategyId: vi.fn(),
            saveStrategyId: vi.fn(),
        })),
        DatabaseEventRegistry: vi.fn().mockImplementation(() => ({
            getLastProcessedEvent: vi.fn(),
            saveLastProcessedEvent: vi.fn(),
        })),
        InMemoryCachedEventRegistry: {
            initialize: vi.fn().mockResolvedValue(mockEventRegistry),
        },
    };
});

describe("SharedDependenciesService", () => {
    const mockEnv: Pick<
        Environment,
        | "DATABASE_URL"
        | "DATABASE_SCHEMA"
        | "INDEXER_GRAPHQL_URL"
        | "INDEXER_ADMIN_SECRET"
        | "PRICING_SOURCE"
        | "METADATA_SOURCE"
        | "NODE_ENV"
    > = {
        DATABASE_URL: "postgresql://localhost:5432/test",
        DATABASE_SCHEMA: "public",
        INDEXER_GRAPHQL_URL: "http://localhost:8080",
        INDEXER_ADMIN_SECRET: "secret",
        PRICING_SOURCE: "dummy",
        METADATA_SOURCE: "public-gateway",
        NODE_ENV: "development",
    };

    it("initializes all dependencies correctly", async () => {
        const dependencies = await SharedDependenciesService.initialize(mockEnv as Environment);

        // Verify database initialization
        expect(createKyselyDatabase).toHaveBeenCalledWith(
            {
                connectionString: mockEnv.DATABASE_URL,
                isProduction: mockEnv.NODE_ENV === "production",
            },
            mocks.logger,
        );

        // Verify providers initialization
        expect(PricingProviderFactory.create).toHaveBeenCalledWith(mockEnv, {
            logger: mocks.logger,
        });

        expect(MetadataProviderFactory.create).toHaveBeenCalledWith(mockEnv, {
            logger: mocks.logger,
        });
        // Verify indexer client initialization
        expect(EnvioIndexerClient).toHaveBeenCalledWith(
            mockEnv.INDEXER_GRAPHQL_URL,
            mockEnv.INDEXER_ADMIN_SECRET,
        );

        // Verify structure of returned dependencies
        expect(dependencies).toHaveProperty("core");
        expect(dependencies).toHaveProperty("registriesRepositories");
        expect(dependencies).toHaveProperty("indexerClient");
        expect(dependencies).toHaveProperty("kyselyDatabase");
        expect(dependencies).toHaveProperty("logger");

        // Verify core dependencies
        expect(dependencies.core).toHaveProperty("projectRepository");
        expect(dependencies.core).toHaveProperty("roundRepository");
        expect(dependencies.core).toHaveProperty("applicationRepository");
        expect(dependencies.core).toHaveProperty("pricingProvider");
        expect(dependencies.core).toHaveProperty("donationRepository");
        expect(dependencies.core).toHaveProperty("metadataProvider");
        expect(dependencies.core).toHaveProperty("applicationPayoutRepository");
        expect(dependencies.core).toHaveProperty("transactionManager");

        // Verify registries
        expect(dependencies.registriesRepositories).toHaveProperty("eventRegistryRepository");
        expect(dependencies.registriesRepositories).toHaveProperty("strategyRegistryRepository");
        expect(dependencies.registriesRepositories).toHaveProperty(
            "strategyProcessingCheckpointRepository",
        );
    });
});
