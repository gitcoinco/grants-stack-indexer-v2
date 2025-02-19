import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IEventRegistryRepository, Project } from "@grants-stack-indexer/repository";
import { Bytes32String, ChainId } from "@grants-stack-indexer/shared";

import { CoreDependencies, IStrategyRegistry } from "../../src/internal.js";
import { Orchestrator } from "../../src/orchestrator.js";
import { DEFAULT_STRATEGY_MAP } from "./helpers/dependencies.js";
import { createTestRegistryEvent, DEFAULT_FROM_ADDRESS } from "./helpers/eventFactory.js";
import { createTestOrchestrator } from "./helpers/setup.js";
import { waitForProcessing } from "./helpers/testing.js";

describe("Orchestrator Integration - Registry Events Processing", () => {
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

    it("process ProfileCreated event and apply InsertProject and InsertProjectRole changesets", async () => {
        const profileCreatedEvent = createTestRegistryEvent<"ProfileCreated">({
            eventName: "ProfileCreated",
            params: {
                profileId:
                    "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b" as Bytes32String,
                nonce: "1",
                name: "Test Project",
                metadata: ["1", "bafkreid3tuk3shg2o3pwc7d677xgymyeuyqccma72my5waiavecrvhxd3m"],
                owner: DEFAULT_FROM_ADDRESS,
                anchor: mockAnchorAddress,
            },
        });

        const { indexerClient } = mocks;
        const { projectRepository, metadataProvider } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue({});
        vi.spyOn(projectRepository, "getPendingProjectRolesByRole").mockResolvedValue([
            {
                id: 1,
                chainId,
                role: profileCreatedEvent.params.profileId,
                address: DEFAULT_FROM_ADDRESS,
                createdAtBlock: BigInt(1234567),
            },
        ]);
        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([profileCreatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        // Verify changesets
        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
            ]),
        );

        expect(projectRepository.insertProject).toHaveBeenCalledWith(
            {
                tags: ["allo-v2"],
                chainId: chainId,
                registryAddress: profileCreatedEvent.srcAddress,
                id: profileCreatedEvent.params.profileId,
                name: profileCreatedEvent.params.name,
                nonce: BigInt(profileCreatedEvent.params.nonce),
                anchorAddress: profileCreatedEvent.params.anchor,
                projectNumber: null,
                metadataCid: profileCreatedEvent.params.metadata[1],
                metadata: null,
                createdByAddress: profileCreatedEvent.transactionFields.from,
                createdAtBlock: BigInt(profileCreatedEvent.blockNumber),
                updatedAtBlock: BigInt(profileCreatedEvent.blockNumber),
                projectType: "canonical",
            },
            {},
        );
        expect(projectRepository.insertProjectRole).toHaveBeenCalledWith(
            {
                chainId: chainId,
                projectId: profileCreatedEvent.params.profileId,
                address: profileCreatedEvent.params.owner,
                role: "owner",
                createdAtBlock: BigInt(profileCreatedEvent.blockNumber),
            },
            {},
        );
        expect(projectRepository.insertProjectRole).toHaveBeenCalledWith(
            {
                chainId: chainId,
                projectId: profileCreatedEvent.params.profileId,
                address: DEFAULT_FROM_ADDRESS,
                role: "member",
                createdAtBlock: BigInt(profileCreatedEvent.blockNumber),
            },
            {},
        );
        expect(projectRepository.deleteManyPendingProjectRoles).toHaveBeenCalledWith([1], {});

        // Verify event was marked as processed
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...profileCreatedEvent,
                rawEvent: profileCreatedEvent,
            },
            {},
        );
    });

    it("process ProfileMetadataUpdated event and apply UpdateProject changeset with valid metadata", async () => {
        const profileMetadataUpdatedEvent = createTestRegistryEvent<"ProfileMetadataUpdated">({
            eventName: "ProfileMetadataUpdated",
            params: {
                profileId:
                    "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b" as Bytes32String,
                metadata: ["1", "ipfs://updated-metadata"],
            },
        });

        const { indexerClient } = mocks;
        const { projectRepository, metadataProvider } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        const updatedMetadata = {
            name: "Updated Project",
            description: "Updated Description",
            type: "project",
        };

        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue(updatedMetadata);
        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([profileMetadataUpdatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );
        expect(projectRepository.updateProject).toHaveBeenCalledWith(
            {
                chainId: chainId,
                id: profileMetadataUpdatedEvent.params.profileId,
            },
            {
                metadataCid: "ipfs://updated-metadata",
                metadata: updatedMetadata,
                projectType: "canonical",
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...profileMetadataUpdatedEvent,
                rawEvent: profileMetadataUpdatedEvent,
            },
            {},
        );
    });

    it("process ProfileMetadataUpdated event and apply UpdateProject changeset with invalid metadata", async () => {
        const profileMetadataUpdatedEvent = createTestRegistryEvent<"ProfileMetadataUpdated">({
            eventName: "ProfileMetadataUpdated",
            params: {
                profileId:
                    "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b" as Bytes32String,
                metadata: ["1", "ipfs://invalid-metadata"],
            },
        });

        const { indexerClient } = mocks;
        const { projectRepository, metadataProvider } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(metadataProvider, "getMetadata").mockResolvedValue({
            invalid: "metadata",
        });
        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([profileMetadataUpdatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );
        expect(projectRepository.updateProject).toHaveBeenCalledWith(
            {
                chainId: chainId,
                id: profileMetadataUpdatedEvent.params.profileId,
            },
            {
                metadataCid: "ipfs://invalid-metadata",
                metadata: null,
                projectType: "canonical",
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...profileMetadataUpdatedEvent,
                rawEvent: profileMetadataUpdatedEvent,
            },
            {},
        );
    });

    it("process ProfileNameUpdated event and apply UpdateProject changeset", async () => {
        const profileNameUpdatedEvent = createTestRegistryEvent<"ProfileNameUpdated">({
            eventName: "ProfileNameUpdated",
            params: {
                profileId:
                    "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b" as Bytes32String,
                name: "Updated Project Name",
                anchor: mockAnchorAddress,
            },
        });

        const { indexerClient } = mocks;
        const { projectRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([profileNameUpdatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything()]),
        );
        expect(projectRepository.updateProject).toHaveBeenCalledWith(
            {
                chainId: chainId,
                id: profileNameUpdatedEvent.params.profileId,
            },
            {
                name: profileNameUpdatedEvent.params.name,
                anchorAddress: profileNameUpdatedEvent.params.anchor,
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...profileNameUpdatedEvent,
                rawEvent: profileNameUpdatedEvent,
            },
            {},
        );
    });

    it("process ProfileOwnerUpdated event and apply DeleteAllProjectRolesByRole and InsertProjectRole changesets", async () => {
        const profileOwnerUpdatedEvent = createTestRegistryEvent<"ProfileOwnerUpdated">({
            eventName: "ProfileOwnerUpdated",
            params: {
                profileId:
                    "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b" as Bytes32String,
                owner: DEFAULT_FROM_ADDRESS,
            },
        });

        const { indexerClient } = mocks;
        const { projectRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(indexerClient, "getEventsAfterBlockNumberAndLogIndex")
            .mockResolvedValueOnce([profileOwnerUpdatedEvent])
            .mockResolvedValue([]);

        const orchestratorPromise = orchestrator.run(abortController.signal);
        await waitForProcessing(eventsFetcherSpy, dataLoaderSpy);

        abortController.abort();
        await orchestratorPromise;

        expect(orchestrator["dataLoader"].applyChanges).toHaveBeenCalledWith(
            expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()]),
        );

        expect(projectRepository.deleteManyProjectRoles).toHaveBeenCalledWith(
            chainId,
            profileOwnerUpdatedEvent.params.profileId,
            "owner",
            undefined,
            {},
        );
        expect(projectRepository.insertProjectRole).toHaveBeenCalledWith(
            {
                chainId: chainId,
                projectId: profileOwnerUpdatedEvent.params.profileId,
                address: profileOwnerUpdatedEvent.params.owner,
                role: "owner",
                createdAtBlock: BigInt(profileOwnerUpdatedEvent.blockNumber),
            },
            {},
        );
        expect(eventsRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(
            chainId,
            {
                ...profileOwnerUpdatedEvent,
                rawEvent: profileOwnerUpdatedEvent,
            },
            {},
        );
    });

    it("process RoleGranted event and apply InsertProjectRole changeset when project exists", async () => {
        const roleGrantedEvent = createTestRegistryEvent<"RoleGranted">({
            eventName: "RoleGranted",
            params: {
                role: "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b" as Bytes32String,
                account: DEFAULT_FROM_ADDRESS,
                sender: DEFAULT_FROM_ADDRESS,
            },
        });

        const { indexerClient } = mocks;
        const { projectRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        // Mock finding existing project
        vi.spyOn(projectRepository, "getProjectById").mockResolvedValue({
            id: roleGrantedEvent.params.role,
            chainId: chainId,
        } as unknown as Project);

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

        expect(projectRepository.insertProjectRole).toHaveBeenCalledWith(
            {
                chainId: chainId,
                projectId: roleGrantedEvent.params.role,
                address: roleGrantedEvent.params.account,
                role: "member",
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

    it("process RoleGranted event and apply InsertPendingProjectRole changeset when project doesn't exist", async () => {
        const roleGrantedEvent = createTestRegistryEvent<"RoleGranted">({
            eventName: "RoleGranted",
            params: {
                role: "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b" as Bytes32String,
                account: DEFAULT_FROM_ADDRESS,
                sender: DEFAULT_FROM_ADDRESS,
            },
        });

        const { indexerClient } = mocks;
        const { projectRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(projectRepository, "getProjectById").mockResolvedValue(undefined);
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
        expect(projectRepository.insertPendingProjectRole).toHaveBeenCalledWith(
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

    it("process RoleRevoked event and apply DeleteAllProjectRolesByRoleAndAddress changeset when project exists", async () => {
        const roleRevokedEvent = createTestRegistryEvent<"RoleRevoked">({
            eventName: "RoleRevoked",
            params: {
                role: "0x384959f32e27e7813e609989ec4636755f933c4bb5b8943cbdb5cf3b8ee7b66b" as Bytes32String,
                account: DEFAULT_FROM_ADDRESS,
                sender: DEFAULT_FROM_ADDRESS,
            },
        });

        const { indexerClient } = mocks;
        const { projectRepository } = mocks.dependencies;
        const { eventsRegistry } = mocks.registries;

        const dataLoaderSpy = vi.spyOn(orchestrator["dataLoader"], "applyChanges");
        const eventsFetcherSpy = vi.spyOn(
            orchestrator["eventsFetcher"],
            "fetchEventsByBlockNumberAndLogIndex",
        );

        vi.spyOn(projectRepository, "getProjectById").mockResolvedValue({
            id: roleRevokedEvent.params.role,
            chainId: chainId,
        } as unknown as Project);
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
        expect(projectRepository.deleteManyProjectRoles).toHaveBeenCalledWith(
            chainId,
            roleRevokedEvent.params.role,
            "member",
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
});
