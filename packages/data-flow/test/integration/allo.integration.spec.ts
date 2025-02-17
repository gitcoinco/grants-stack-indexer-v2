import { parseUnits, zeroAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IEventRegistryRepository, Round } from "@grants-stack-indexer/repository";
import { Bytes32String, ChainId } from "@grants-stack-indexer/shared";

import { CoreDependencies, IStrategyRegistry } from "../../src/internal.js";
import { Orchestrator } from "../../src/orchestrator.js";
import { DEFAULT_STRATEGY_MAP } from "./helpers/dependencies.js";
import {
    createTestAlloEvent,
    DEFAULT_FROM_ADDRESS,
    DEFAULT_TIMESTAMP_MS,
} from "./helpers/eventFactory.js";
import { createTestOrchestrator } from "./helpers/setup.js";
import { waitForProcessing } from "./helpers/testing.js";

describe("Orchestrator Integration - Allo Events Processing", () => {
    let abortController: AbortController;
    let runPromise: Promise<void> | undefined;
    let orchestrator: Orchestrator;
    let mocks: {
        dependencies: CoreDependencies;
        indexerClient: IIndexerClient;
        registries: {
            eventsRegistry: IEventRegistryRepository;
            strategyRegistry: IStrategyRegistry;
        };
    };
    const chainId = 1 as ChainId;

    beforeEach(() => {
        const res = createTestOrchestrator({
            chainId,
            strategiesMap: DEFAULT_STRATEGY_MAP,
        });

        orchestrator = res.orchestrator;
        mocks = res.mocks;

        abortController = new AbortController();
        runPromise = undefined;
    });

    afterEach(async () => {
        vi.clearAllMocks();

        abortController.abort();

        await runPromise;

        runPromise = undefined;
    });

    it("process PoolCreated event and apply InsertRound, InsertRoundRole, DeletePendingRoundRoles changesets", async () => {
        // Create test event
        const poolCreatedEvent = createTestAlloEvent<"PoolCreated">({
            contractName: "Allo",
            eventName: "PoolCreated",
            params: {
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                amount: "0",
                poolId: "13",
                metadata: ["1", "bafkreid3tuk3shg2o3pwc7d677xgymyeuyqccma72my5waiavecrvhxd3m"],
                strategy: "0xF5F6Ca46a9DA3C1089d0F2F029cF14F3F714D483",
                profileId: "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b",
            },
        });

        const { indexerClient } = mocks;
        const { roundRepository, metadataProvider, evmProvider } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );
        const strategyTiming = BigInt(DEFAULT_TIMESTAMP_MS / 1000);
        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([poolCreatedEvent])
            .mockResolvedValue([]);
        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue({});
        vi.spyOn(evmProvider, "readContract").mockResolvedValue(strategyTiming);
        vi.spyOn(roundRepository, "getPendingRoundRoles").mockImplementation((_, name) => {
            if (name === "admin") {
                return Promise.resolve([
                    {
                        id: 1,
                        chainId: 1 as ChainId,
                        role: "admin",
                        address: "0x123",
                        createdAtBlock: 1234567n,
                    },
                ]);
            }
            return Promise.resolve([]);
        });

        // Run orchestrator
        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
            ]),
        ); // just checking that it was called with 4 changesets

        expect(roundRepository.insertRound).toHaveBeenCalledWith(
            {
                chainId: poolCreatedEvent.chainId,
                id: poolCreatedEvent.params.poolId,
                tags: ["allo-v2"],
                totalDonationsCount: 0,
                totalAmountDonatedInUsd: "0",
                uniqueDonorsCount: 0,
                matchTokenAddress: zeroAddress,
                matchAmount: 0n,
                matchAmountInUsd: "0",
                fundedAmount: 0n,
                fundedAmountInUsd: "0",
                applicationMetadataCid: poolCreatedEvent.params.metadata[1],
                applicationMetadata: {},
                roundMetadataCid: poolCreatedEvent.params.metadata[1],
                roundMetadata: null,
                applicationsStartTime: new Date(Number(strategyTiming) * 1000),
                applicationsEndTime: new Date(Number(strategyTiming) * 1000),
                donationsStartTime: null,
                donationsEndTime: null,
                managerRole: "0x000000000000000000000000000000000000000000000000000000000000000d",
                adminRole: "0x9c5c8058ff40e9ac62e1dc94ec9ac5e3e6ba7512881310db09ea2196e5e82f38",
                strategyAddress: poolCreatedEvent.params.strategy,
                strategyId: DEFAULT_STRATEGY_MAP.get(chainId)?.get(
                    poolCreatedEvent.params.strategy,
                ),
                strategyName: "allov2.DirectGrantsLiteStrategy",
                createdByAddress: poolCreatedEvent.transactionFields.from,
                createdAtBlock: BigInt(poolCreatedEvent.blockNumber),
                updatedAtBlock: BigInt(poolCreatedEvent.blockNumber),
                projectId: poolCreatedEvent.params.profileId,
                totalDistributed: 0n,
                readyForPayoutTransaction: null,
                matchingDistribution: null,
            },
            {},
        );
        expect(roundRepository.insertRoundRole).toHaveBeenCalledWith(
            {
                chainId: poolCreatedEvent.chainId,
                roundId: poolCreatedEvent.params.poolId,
                address: "0x123",
                role: "admin",
                createdAtBlock: 1234567n,
            },
            {},
        );
        expect(roundRepository.deleteManyPendingRoundRoles).toHaveBeenCalledWith([1], {});
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            1 as ChainId,
            {
                ...poolCreatedEvent,
                rawEvent: poolCreatedEvent,
            },
            {},
        );
    });

    it("process PoolFunded event and apply IncrementRoundFundedAmount changeset", async () => {
        // Create test event
        const poolFundedEvent = createTestAlloEvent<"PoolFunded">({
            contractName: "Allo",
            eventName: "PoolFunded",
            params: {
                poolId: "13",
                amount: "1000000000000000000", // 1 ETH
                fee: "10000000000000000", // 0.01 ETH
            },
        });

        const { indexerClient } = mocks;
        const { roundRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock the round data
        vi.spyOn(roundRepository, "getRoundByIdOrThrow").mockResolvedValue({
            id: "13",
            chainId: chainId,
            matchTokenAddress: zeroAddress, // ETH
        } as unknown as Round);

        // Mock indexer to return our event
        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([poolFundedEvent])
            .mockResolvedValue([]);

        // Run orchestrator
        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );
        expect(roundRepository.incrementRoundFunds).toHaveBeenCalledWith(
            {
                chainId: chainId,
                roundId: "13",
            },
            BigInt("1000000000000000000"),
            "1",
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...poolFundedEvent,
                rawEvent: poolFundedEvent,
            },
            {},
        );
    });

    it("process PoolMetadataUpdated event and apply UpdateRound changeset", async () => {
        const poolMetadataUpdatedEvent = createTestAlloEvent<"PoolMetadataUpdated">({
            contractName: "Allo",
            eventName: "PoolMetadataUpdated",
            params: {
                poolId: "13",
                metadata: ["1", "bafkreiadxn64e7ibijctm67flwgbjpsy36avvfsrmzyvraffnwsg75yki4"],
            },
        });

        const { indexerClient } = mocks;
        const { roundRepository, metadataProvider } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(roundRepository, "getRoundByIdOrThrow").mockResolvedValue({
            id: "13",
            chainId: chainId,
            matchTokenAddress: zeroAddress,
            matchAmount: 0n,
            matchAmountInUsd: "0",
        } as unknown as Round);
        const updatedMetadata = {
            round: {
                name: "QuantumStake: Revolutionizing Staking in the Crypto space | Ethereum",
                roundType: "public",
                quadraticFundingConfig: {
                    matchingFundsAvailable: 209500,
                },
            },
            application: {
                version: "2.0.0",
                lastUpdatedOn: 1716414832557,
            },
        };
        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue(updatedMetadata);
        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([poolMetadataUpdatedEvent])
            .mockResolvedValue([]);

        // Run orchestrator
        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);
        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );
        expect(roundRepository.updateRound).toHaveBeenCalledWith(
            {
                chainId: chainId,
                id: poolMetadataUpdatedEvent.params.poolId,
            },
            {
                matchAmount: parseUnits("209500", 18),
                matchAmountInUsd: "209500",
                applicationMetadataCid:
                    "bafkreiadxn64e7ibijctm67flwgbjpsy36avvfsrmzyvraffnwsg75yki4",
                applicationMetadata: updatedMetadata.application,
                roundMetadataCid: "bafkreiadxn64e7ibijctm67flwgbjpsy36avvfsrmzyvraffnwsg75yki4",
                roundMetadata: updatedMetadata.round,
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...poolMetadataUpdatedEvent,
                rawEvent: poolMetadataUpdatedEvent,
            },
            {},
        );
    });

    it("process RoleGranted event and apply InsertRoundRole changeset when role matches admin role", async () => {
        const roleGrantedEvent = createTestAlloEvent<"RoleGranted">({
            contractName: "Allo",
            eventName: "RoleGranted",
            params: {
                role: "0x000000000000000000000000000000000000000000000000000000000000000d" as Bytes32String,
                account: DEFAULT_FROM_ADDRESS,
                sender: DEFAULT_FROM_ADDRESS,
            },
        });

        const { indexerClient } = mocks;
        const { roundRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock finding round by admin role
        vi.spyOn(roundRepository, "getRoundByRole").mockImplementation(
            async (chainId, roleType, role) => {
                if (roleType === "admin" && role === roleGrantedEvent.params.role.toLowerCase()) {
                    return {
                        id: "13",
                        chainId,
                    } as unknown as Round;
                }
                return undefined;
            },
        );

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([roleGrantedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(roundRepository.insertRoundRole).toHaveBeenCalledWith(
            {
                chainId: chainId,
                roundId: "13",
                role: "admin",
                address: roleGrantedEvent.params.account,
                createdAtBlock: BigInt(roleGrantedEvent.blockNumber),
            },
            {},
        );

        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...roleGrantedEvent,
                rawEvent: roleGrantedEvent,
            },
            {},
        );
    });

    it("process RoleGranted event and apply InsertPendingRoundRole changeset when role doesn't match any round", async () => {
        const roleGrantedEvent = createTestAlloEvent<"RoleGranted">({
            contractName: "Allo",
            eventName: "RoleGranted",
            params: {
                role: "0x1234567890123456789012345678901234567890123456789012345678901234" as Bytes32String,
                account: DEFAULT_FROM_ADDRESS,
                sender: DEFAULT_FROM_ADDRESS,
            },
        });

        const { indexerClient } = mocks;
        const { roundRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock finding no round for the role
        vi.spyOn(roundRepository, "getRoundByRole").mockResolvedValue(undefined);

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([roleGrantedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(roundRepository.insertPendingRoundRole).toHaveBeenCalledWith(
            {
                chainId: chainId,
                role: roleGrantedEvent.params.role.toLowerCase(),
                address: roleGrantedEvent.params.account,
                createdAtBlock: BigInt(roleGrantedEvent.blockNumber),
            },
            {},
        );

        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...roleGrantedEvent,
                rawEvent: roleGrantedEvent,
            },
            {},
        );
    });

    it("process RoleRevoked event and apply DeleteAllRoundRolesByRoleAndAddress changeset when role matches admin role", async () => {
        const roleRevokedEvent = createTestAlloEvent<"RoleRevoked">({
            contractName: "Allo",
            eventName: "RoleRevoked",
            params: {
                role: "0x000000000000000000000000000000000000000000000000000000000000000d" as Bytes32String, // admin role
                account: DEFAULT_FROM_ADDRESS,
                sender: DEFAULT_FROM_ADDRESS,
            },
        });

        const { indexerClient } = mocks;
        const { roundRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock finding round by admin role
        vi.spyOn(roundRepository, "getRoundByRole").mockImplementation(
            async (chainId, roleType, role) => {
                if (roleType === "admin" && role === roleRevokedEvent.params.role.toLowerCase()) {
                    return {
                        id: "13",
                        chainId,
                    } as unknown as Round;
                }
                return undefined;
            },
        );

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([roleRevokedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(roundRepository.deleteManyRoundRolesByRoleAndAddress).toHaveBeenCalledWith(
            chainId,
            "13",
            "admin",
            roleRevokedEvent.params.account,
            {},
        );

        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...roleRevokedEvent,
                rawEvent: roleRevokedEvent,
            },
            {},
        );
    });

    it("process RoleRevoked event and only log warning when role doesn't match any round", async () => {
        const roleRevokedEvent = createTestAlloEvent<"RoleRevoked">({
            contractName: "Allo",
            eventName: "RoleRevoked",
            params: {
                role: "0x1234567890123456789012345678901234567890123456789012345678901234" as Bytes32String, // unknown role
                account: DEFAULT_FROM_ADDRESS,
                sender: DEFAULT_FROM_ADDRESS,
            },
        });

        const { indexerClient } = mocks;
        const { roundRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock finding no round for the role
        vi.spyOn(roundRepository, "getRoundByRole").mockResolvedValue(undefined);

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([roleRevokedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything()]),
        );
        expect(roundRepository.deleteManyPendingRoundRoles).not.toHaveBeenCalled();
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...roleRevokedEvent,
                rawEvent: roleRevokedEvent,
            },
            {},
        );
    });
});
