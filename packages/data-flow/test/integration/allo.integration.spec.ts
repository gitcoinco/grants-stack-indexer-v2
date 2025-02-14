import { zeroAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IEventRegistryRepository } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { CoreDependencies, IStrategyRegistry } from "../../src/internal.js";
import { Orchestrator } from "../../src/orchestrator.js";
import { DEFAULT_STRATEGY_MAP } from "./helpers/dependencies.js";
import { createTestAlloEvent, DEFAULT_TIMESTAMP_MS } from "./helpers/eventFactory.js";
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
        }) as ProcessorEvent<"Allo", "PoolCreated">;

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
        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue(undefined);
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
});
