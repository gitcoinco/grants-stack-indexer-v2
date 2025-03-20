import { randomBytes } from "crypto";
import { bytesToHex, zeroAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import {
    Application,
    IEventRegistryRepository,
    Project,
    Round,
} from "@grants-stack-indexer/repository";
import { Bytes32String, ChainId } from "@grants-stack-indexer/shared";

import { CoreDependencies, IStrategyRegistry } from "../../src/internal.js";
import { Orchestrator } from "../../src/orchestrator.js";
import { DEFAULT_STRATEGY_MAP } from "./helpers/dependencies.js";
import { createTestStrategyEvent, DEFAULT_FROM_ADDRESS } from "./helpers/eventFactory.js";
import { createTestOrchestrator } from "./helpers/setup.js";
import { waitForProcessing } from "./helpers/testing.js";

describe("Orchestrator Integration - Strategy Events Processing", () => {
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
    const mockAnchorAddress = DEFAULT_FROM_ADDRESS;

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

    it("process Distributed event and apply IncrementRoundTotalDistributed changeset", async () => {
        const distributedEvent = createTestStrategyEvent<"DistributedWithRecipientAddress">({
            eventName: "DistributedWithRecipientAddress",
            params: {
                recipientId: DEFAULT_FROM_ADDRESS,
                recipientAddress: DEFAULT_FROM_ADDRESS,
                amount: "1000000000000000000",
                sender: DEFAULT_FROM_ADDRESS,
            },

            srcAddress: "0xD5F6cA46A9DA3c1089D0F2F029CF14F3f714D483",
        });

        const { indexerClient } = mocks;
        const { roundRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(roundRepository, "getRoundByStrategyAddress").mockResolvedValue({
            id: "13",
            chainId: chainId,
        } as unknown as Round);

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([distributedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(roundRepository.incrementRoundTotalDistributed).toHaveBeenCalledWith(
            { chainId, roundId: "13" },
            BigInt(distributedEvent.params.amount),
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...distributedEvent,
                rawEvent: distributedEvent,
            },
            {},
        );
    });

    it("process DistributionUpdatedWithMerkleRoot event and apply UpdateRoundByStrategyAddress changeset", async () => {
        const distributionUpdatedEvent =
            createTestStrategyEvent<"DistributionUpdatedWithMerkleRoot">({
                eventName: "DistributionUpdatedWithMerkleRoot",
                params: {
                    metadata: ["1", "ipfs://distribution-metadata"],
                    merkleRoot: bytesToHex(Uint8Array.from(randomBytes(32))) as Bytes32String,
                },
                srcAddress: "0xD5F6cA46A9DA3c1089D0F2F029CF14F3f714D483",
            });

        const { indexerClient } = mocks;
        const { roundRepository, metadataProvider } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        const mockDistribution = {
            matchingDistribution: [
                {
                    contributionsCount: 44,
                    projectPayoutAddress: "0x7340F1a1e4e38F43d2FCC85cdb2b764de36B40c0",
                    applicationId: "3",
                    matchPoolPercentage: 0.099999,
                    projectId: "0x15c5e4db5530e05216abc9484025e2f1c4fb55b8525d29ef38fde237e767e324",
                    projectName: "ReFi DAO - A Network Society to Regenerate Earth. ✨ 🌱",
                    matchAmountInToken: "999999999999999475712",
                    originalMatchAmountInToken: "999999999999999475712",
                },
                {
                    contributionsCount: 69,
                    projectPayoutAddress: "0x01d1909cA27E364904934849eab8399532dd5c8b",
                    applicationId: "11",
                    matchPoolPercentage: 0.099999,
                    projectId: "0xca460772f5ba0840a589d2c19fb7e17ac259e4be884313e3712c06c9c885dc93",
                    projectName: "Giveth",
                    matchAmountInToken: "999999999999999475712",
                    originalMatchAmountInToken: "999999999999999475712",
                },
            ],
        };

        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue(mockDistribution);

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([distributionUpdatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(roundRepository.updateRound).toHaveBeenCalledWith(
            { chainId, strategyAddress: distributionUpdatedEvent.srcAddress },
            {
                readyForPayoutTransaction: distributionUpdatedEvent.transactionFields.hash,
                matchingDistribution: mockDistribution.matchingDistribution,
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...distributionUpdatedEvent,
                rawEvent: distributionUpdatedEvent,
            },
            {},
        );
    });

    it("process DistributionUpdated event and apply UpdateRoundByStrategyAddress changeset", async () => {
        const distributionUpdatedEvent = createTestStrategyEvent<"DistributionUpdated">({
            eventName: "DistributionUpdated",
            params: {
                metadata: ["1", "ipfs://distribution-metadata"],
            },
            srcAddress: "0x43E08E93DfB437D027CE71c60a904C2E8f72CB4a",
        });

        const { indexerClient } = mocks;
        const { roundRepository, metadataProvider } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        const mockDistribution = {
            matchingDistribution: [
                {
                    contributionsCount: 44,
                    projectPayoutAddress: "0x7340F1a1e4e38F43d2FCC85cdb2b764de36B40c0",
                    applicationId: "3",
                    matchPoolPercentage: 0.099999,
                    projectId: "0x15c5e4db5530e05216abc9484025e2f1c4fb55b8525d29ef38fde237e767e324",
                    projectName: "ReFi DAO - A Network Society to Regenerate Earth. ✨ 🌱",
                    matchAmountInToken: "999999999999999475712",
                    originalMatchAmountInToken: "999999999999999475712",
                },
                {
                    contributionsCount: 69,
                    projectPayoutAddress: "0x01d1909cA27E364904934849eab8399532dd5c8b",
                    applicationId: "11",
                    matchPoolPercentage: 0.099999,
                    projectId: "0xca460772f5ba0840a589d2c19fb7e17ac259e4be884313e3712c06c9c885dc93",
                    projectName: "Giveth",
                    matchAmountInToken: "999999999999999475712",
                    originalMatchAmountInToken: "999999999999999475712",
                },
            ],
        };

        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue(mockDistribution);

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([distributionUpdatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(roundRepository.updateRound).toHaveBeenCalledWith(
            { chainId, strategyAddress: distributionUpdatedEvent.srcAddress },
            {
                readyForPayoutTransaction: distributionUpdatedEvent.transactionFields.hash,
                matchingDistribution: mockDistribution.matchingDistribution,
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...distributionUpdatedEvent,
                rawEvent: distributionUpdatedEvent,
            },
            {},
        );
    });

    it("process FundsDistributed event and apply UpdateApplication and IncrementRoundTotalDistributed changesets", async () => {
        const fundsDistributedEvent = createTestStrategyEvent<"FundsDistributed">({
            eventName: "FundsDistributed",
            params: {
                recipientId: DEFAULT_FROM_ADDRESS,
                amount: "1000000000000000000",
                grantee: DEFAULT_FROM_ADDRESS,
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            },
            srcAddress: "0xD5F6cA46A9DA3c1089D0F2F029CF14F3f714D483",
        });

        const { indexerClient } = mocks;
        const { roundRepository, applicationRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock finding round and application
        vi.spyOn(roundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue({
            id: "13",
            chainId: chainId,
        } as unknown as Round);
        vi.spyOn(applicationRepository, "getApplicationByAnchorAddressOrThrow").mockResolvedValue({
            id: "1",
            chainId: chainId,
        } as unknown as Application);

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([fundsDistributedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()]),
        );

        expect(applicationRepository.updateApplication).toHaveBeenCalledWith(
            { chainId, roundId: "13", id: "1" },
            {
                distributionTransaction: fundsDistributedEvent.transactionFields.hash,
            },
            {},
        );
        expect(roundRepository.incrementRoundTotalDistributed).toHaveBeenCalledWith(
            { chainId, roundId: "13" },
            BigInt(fundsDistributedEvent.params.amount),
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...fundsDistributedEvent,
                rawEvent: fundsDistributedEvent,
            },
            {},
        );
    });

    it("process RecipientStatusUpdated event and apply UpdateApplication changesets", async () => {
        const recipientStatusUpdatedEvent =
            createTestStrategyEvent<"RecipientStatusUpdatedWithFullRow">({
                eventName: "RecipientStatusUpdatedWithFullRow",
                params: {
                    rowIndex: "0",
                    fullRow: "801", // 001100100001 (status 1 at index 0, status 2 at index 4, status 3 at index 8)
                    sender: DEFAULT_FROM_ADDRESS,
                },
                srcAddress: "0xD5F6cA46A9DA3c1089D0F2F029CF14F3f714D483",
            });

        const { indexerClient } = mocks;
        const { roundRepository, applicationRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock finding round and application
        vi.spyOn(roundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue({
            id: "13",
            chainId: chainId,
        } as unknown as Round);

        vi.spyOn(applicationRepository, "getApplicationById")
            .mockResolvedValueOnce({
                id: "0",
                chainId: chainId,
                status: "PENDING",
                statusSnapshots: [],
                statusUpdatedAtBlock: BigInt(recipientStatusUpdatedEvent.blockNumber - 100),
            } as unknown as Application)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                id: "8",
                chainId: chainId,
                status: "PENDING",
                statusSnapshots: [],
                statusUpdatedAtBlock: BigInt(recipientStatusUpdatedEvent.blockNumber - 100),
            } as unknown as Application);

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([recipientStatusUpdatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()]),
        );

        expect(applicationRepository.updateApplication).toHaveBeenNthCalledWith(
            1,
            { chainId, roundId: "13", id: "0" },
            {
                status: "PENDING",
                statusUpdatedAtBlock: BigInt(recipientStatusUpdatedEvent.blockNumber),
                statusSnapshots: [],
            },
            {},
        );
        expect(applicationRepository.updateApplication).toHaveBeenNthCalledWith(
            2,
            { chainId, roundId: "13", id: "8" },
            {
                status: "REJECTED",
                statusUpdatedAtBlock: BigInt(recipientStatusUpdatedEvent.blockNumber),
                statusSnapshots: [
                    {
                        status: "REJECTED",
                        updatedAtBlock: recipientStatusUpdatedEvent.blockNumber.toString(),
                        updatedAt: new Date(recipientStatusUpdatedEvent.blockTimestamp),
                    },
                ],
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...recipientStatusUpdatedEvent,
                rawEvent: recipientStatusUpdatedEvent,
            },
            {},
        );
    });

    it("process Allocated event and apply InsertDonation changeset", async () => {
        const allocatedEvent = createTestStrategyEvent<"AllocatedWithOrigin">({
            eventName: "AllocatedWithOrigin",
            params: {
                recipientId: mockAnchorAddress,
                amount: "1000000000000000000",
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                origin: DEFAULT_FROM_ADDRESS,
                sender: DEFAULT_FROM_ADDRESS,
            },
            srcAddress: "0xD5F6cA46A9DA3c1089D0F2F029CF14F3f714D483",
        });

        const { indexerClient } = mocks;
        const { roundRepository, applicationRepository, donationRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(roundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue({
            id: "13",
            chainId: chainId,
            matchTokenAddress: zeroAddress,
        } as unknown as Round);
        vi.spyOn(applicationRepository, "getApplicationByAnchorAddressOrThrow").mockResolvedValue({
            id: "1",
            chainId: chainId,
            projectId: "project-1",
            metadata: {
                application: {
                    round: "13",
                    recipient: mockAnchorAddress,
                },
            },
        } as unknown as Application);
        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([allocatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(donationRepository.insertDonation).toHaveBeenCalledWith(
            {
                id: "0xfb5c2bf736a7b61e8ddad746b8166fc6d381dc877232559252fa5f3c4b6715c2",
                chainId: chainId,
                roundId: "13",
                applicationId: "1",
                donorAddress: DEFAULT_FROM_ADDRESS,
                recipientAddress: mockAnchorAddress,
                projectId: "project-1",
                transactionHash: allocatedEvent.transactionFields.hash,
                blockNumber: BigInt(allocatedEvent.blockNumber),
                tokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                amount: BigInt(allocatedEvent.params.amount),
                amountInUsd: "1",
                amountInRoundMatchToken: BigInt(allocatedEvent.params.amount),
                timestamp: new Date(allocatedEvent.blockTimestamp),
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...allocatedEvent,
                rawEvent: allocatedEvent,
            },
            {},
        );
    });

    it("process Allocated event and apply InsertApplicationPayout changeset", async () => {
        const allocatedEvent = createTestStrategyEvent({
            eventName: "AllocatedWithToken",
            params: {
                recipientId: mockAnchorAddress,
                amount: "1000000000000000000",
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                sender: DEFAULT_FROM_ADDRESS,
            },
            srcAddress: "0xF5F6Ca46a9DA3C1089d0F2F029cF14F3F714D483",
        });

        const { indexerClient } = mocks;
        const { roundRepository, applicationRepository, applicationPayoutRepository } =
            mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(roundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue({
            id: "13",
            chainId: chainId,
            matchTokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        } as unknown as Round);

        vi.spyOn(applicationRepository, "getApplicationByAnchorAddressOrThrow").mockResolvedValue({
            id: "1",
            chainId: chainId,
        } as unknown as Application);

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([allocatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(applicationPayoutRepository.insertApplicationPayout).toHaveBeenCalledWith(
            {
                amount: BigInt(allocatedEvent.params.amount),
                applicationId: "1",
                roundId: "13",
                chainId: chainId,
                tokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                amountInRoundMatchToken: BigInt(allocatedEvent.params.amount),
                amountInUsd: "1",
                transactionHash: allocatedEvent.transactionFields.hash,
                sender: DEFAULT_FROM_ADDRESS,
                timestamp: new Date(allocatedEvent.blockTimestamp),
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...allocatedEvent,
                rawEvent: allocatedEvent,
            },
            {},
        );
    });

    it("process Registered event and apply InsertApplication changeset", async () => {
        const registeredEvent = createTestStrategyEvent<"RegisteredWithSender">({
            eventName: "RegisteredWithSender",
            params: {
                recipientId: mockAnchorAddress,
                data: "0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001000000000000000000000000002c7296a5ec0539f0a018c7176c97c92a9c44e2b4000000000000000000000000e7eb5d2b5b188777df902e89c54570e7ef4f59ce000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000",
                sender: DEFAULT_FROM_ADDRESS,
            },
            srcAddress: "0xD5F6cA46A9DA3c1089D0F2F029CF14F3f714D483",
        });

        const { indexerClient } = mocks;
        const { roundRepository, projectRepository, metadataProvider, applicationRepository } =
            mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock finding project and round
        vi.spyOn(projectRepository, "getProjectByAnchorOrThrow").mockResolvedValue({
            id: "project-1",
            chainId: chainId,
        } as unknown as Project);

        vi.spyOn(roundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue({
            id: "13",
            chainId: chainId,
        } as unknown as Round);

        // Mock metadata
        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue({
            name: "Test Application",
        });

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([registeredEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );

        expect(applicationRepository.insertApplication).toHaveBeenCalledWith(
            {
                chainId: chainId,
                id: "0",
                roundId: "13",
                projectId: "project-1",
                anchorAddress: mockAnchorAddress,
                status: "PENDING",
                createdByAddress: DEFAULT_FROM_ADDRESS,
                metadataCid: "bafkreigyc43cfinxlnahq5aawsghibetv6usrs7kkxf7vxmzbjyro76iwy",
                metadata: {
                    name: "Test Application",
                },
                createdAtBlock: BigInt(registeredEvent.blockNumber),
                statusUpdatedAtBlock: BigInt(registeredEvent.blockNumber),
                statusSnapshots: [
                    {
                        status: "PENDING",
                        updatedAtBlock: registeredEvent.blockNumber.toString(),
                        updatedAt: new Date(registeredEvent.blockTimestamp),
                    },
                ],
                distributionTransaction: null,
                totalAmountDonatedInUsd: 0,
                totalDonationsCount: 0,
                uniqueDonorsCount: 0,
                tags: ["allo-v2"],
                timestamp: new Date(registeredEvent.blockTimestamp),
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...registeredEvent,
                rawEvent: registeredEvent,
            },
            {},
        );
    });
});
