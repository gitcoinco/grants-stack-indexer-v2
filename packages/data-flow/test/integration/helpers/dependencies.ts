import { Address, Hex } from "viem";
import { vi } from "vitest";

import type { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import type {
    IEventRegistryRepository,
    TransactionConnection,
} from "@grants-stack-indexer/repository";
import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { DummyPricingProvider } from "@grants-stack-indexer/pricing";
import { ChainId } from "@grants-stack-indexer/shared";

import { CoreDependencies, IStrategyRegistry } from "../../../src/internal.js";

// Mock repositories with Vi spies
export const createMockRepositories = (): Pick<
    CoreDependencies,
    | "projectRepository"
    | "roundRepository"
    | "applicationRepository"
    | "donationRepository"
    | "applicationPayoutRepository"
    | "transactionManager"
    | "legacyProjectRepository"
> => ({
    projectRepository: {
        getProjects: vi.fn(),
        insertProject: vi.fn(),
        updateProject: vi.fn(),
        insertProjectRole: vi.fn(),
        deleteManyProjectRoles: vi.fn(),
        insertPendingProjectRole: vi.fn(),
        deleteManyPendingProjectRoles: vi.fn(),
        getProjectById: vi.fn(),
        getProjectByIdOrThrow: vi.fn(),
        getPendingProjectRoles: vi.fn(),
        getPendingProjectRolesByRole: vi.fn(),
        getProjectByAnchor: vi.fn(),
        getProjectByAnchorOrThrow: vi.fn(),
    },
    legacyProjectRepository: {
        insertLegacyProject: vi.fn(),
    },
    roundRepository: {
        getRounds: vi.fn(),
        getRoundById: vi.fn(),
        insertRound: vi.fn(),
        updateRound: vi.fn(),
        incrementRoundFunds: vi.fn(),
        incrementRoundTotalDistributed: vi.fn(),
        insertRoundRole: vi.fn(),
        deleteManyRoundRolesByRoleAndAddress: vi.fn(),
        insertPendingRoundRole: vi.fn(),
        deleteManyPendingRoundRoles: vi.fn(),
        getRoundByIdOrThrow: vi.fn(),
        getRoundByStrategyAddress: vi.fn(),
        getRoundByStrategyAddressOrThrow: vi.fn(),
        getRoundByRole: vi.fn(),
        getRoundMatchTokenAddressById: vi.fn(),
        getRoundRoles: vi.fn(),
        getPendingRoundRoles: vi.fn(),
    },
    applicationRepository: {
        insertApplication: vi.fn(),
        updateApplication: vi.fn(),
        getApplicationById: vi.fn(),
        getApplicationByProjectId: vi.fn(),
        getApplicationByAnchorAddress: vi.fn(),
        getApplicationByAnchorAddressOrThrow: vi.fn(),
        getApplicationsByRoundId: vi.fn(),
    },
    donationRepository: {
        insertDonation: vi.fn(),
        insertManyDonations: vi.fn(),
    },
    applicationPayoutRepository: {
        insertApplicationPayout: vi.fn(),
    },
    transactionManager: {
        runInTransaction: vi
            .fn()
            .mockImplementation((fn: (tx: TransactionConnection) => Promise<unknown>) => {
                return fn({} as TransactionConnection);
            }),
    },
});

// Mock providers
export const createMockProviders = (): Pick<
    CoreDependencies,
    "pricingProvider" | "metadataProvider" | "evmProvider"
> => ({
    pricingProvider: new DummyPricingProvider(),
    metadataProvider: {
        getMetadata: vi.fn(),
    },
    evmProvider: {
        getMulticall3Address: vi.fn().mockReturnValue(undefined),
        getTransaction: vi.fn(),
        getBalance: vi.fn(),
        readContract: vi.fn(),
        multicall: vi.fn(),
    } as unknown as EvmProvider,
});

export const createMockIndexerClient = (): IIndexerClient => ({
    getEventsAfterBlockNumberAndLogIndex: vi.fn(),
    getEvents: vi.fn(),
    getBlockRangeTimestampByChainId: vi.fn(),
});

export const DEFAULT_STRATEGY_MAP = new Map<ChainId, Map<Address, Hex>>([
    [
        1 as ChainId,
        new Map([
            [
                "0xF5F6Ca46a9DA3C1089d0F2F029cF14F3F714D483",
                "0x103732a8e473467a510d4128ee11065262bdd978f0d9dad89ba68f2c56127e27",
            ],
            [
                "0xD5F6cA46A9DA3c1089D0F2F029CF14F3f714D483",
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf",
            ],
        ]),
    ],
]);

export const createMockRegistries = (
    strategiesMap: Map<ChainId, Map<Address, Hex>>,
): {
    eventsRegistry: IEventRegistryRepository;
    strategyRegistry: IStrategyRegistry;
} => ({
    eventsRegistry: {
        saveLastProcessedEvent: vi.fn(),
        getLastProcessedEvent: vi.fn(),
    },
    strategyRegistry: {
        getStrategyId: vi.fn().mockImplementation((chainId: ChainId, strategyAddress: Address) => {
            const chainIdMap = strategiesMap.get(chainId);
            if (!chainIdMap) {
                return undefined;
            }
            const strategyId = chainIdMap.get(strategyAddress);
            if (!strategyId) {
                return undefined;
            }
            return {
                id: strategyId,
                address: strategyAddress,
                chainId: chainId,
                handled: true,
            };
        }),
        saveStrategyId: vi.fn(),
        getStrategies: vi.fn(),
    },
});
