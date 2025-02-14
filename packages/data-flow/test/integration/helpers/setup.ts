import { vi } from "vitest";

import type { Address, ChainId, Hex, ILogger } from "@grants-stack-indexer/shared";
import { type IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IEventRegistryRepository } from "@grants-stack-indexer/repository";
import { ExponentialBackoff } from "@grants-stack-indexer/shared";

import { CoreDependencies, IStrategyRegistry } from "../../../src/internal.js";
import { Orchestrator } from "../../../src/orchestrator.js";
import {
    createMockIndexerClient,
    createMockProviders,
    createMockRegistries,
    createMockRepositories,
    DEFAULT_STRATEGY_MAP,
} from "./dependencies.js";

export const createTestOrchestrator = (
    config: {
        chainId: ChainId;
        strategiesMap: Map<ChainId, Map<Address, Hex>>;
    } = { chainId: 1 as ChainId, strategiesMap: DEFAULT_STRATEGY_MAP },
): {
    orchestrator: Orchestrator;
    mocks: {
        dependencies: CoreDependencies;
        indexerClient: IIndexerClient;
        registries: {
            eventsRegistry: IEventRegistryRepository;
            strategyRegistry: IStrategyRegistry;
        };
        logger: ILogger;
    };
} => {
    const repositories = createMockRepositories();
    const providers = createMockProviders();
    const mockNotifier = {
        send: vi.fn(),
    };
    const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
    };
    const mockIndexerClient = createMockIndexerClient();
    const { eventsRegistry, strategyRegistry } = createMockRegistries(config.strategiesMap);

    const dependencies: CoreDependencies = {
        ...repositories,
        ...providers,
    };

    const orchestrator = new Orchestrator(
        config.chainId,
        dependencies,
        mockIndexerClient,
        {
            eventsRegistry,
            strategyRegistry,
        },
        1000,
        0, // No delay in tests
        new ExponentialBackoff({ baseDelay: 10, factor: 2, maxAttempts: 1 }),
        mockLogger,
        mockNotifier,
    );

    return {
        orchestrator,
        mocks: {
            dependencies,
            logger: mockLogger,
            indexerClient: mockIndexerClient,
            registries: {
                eventsRegistry,
                strategyRegistry,
            },
        },
    };
};
