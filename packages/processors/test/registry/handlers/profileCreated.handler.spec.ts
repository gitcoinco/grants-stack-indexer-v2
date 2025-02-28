import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import {
    Bytes32String,
    ChainId,
    ILogger,
    ProcessorEvent,
    TimestampMs,
} from "@grants-stack-indexer/shared";

import { ProcessorDependencies } from "../../../src/internal.js";
import { ProfileCreatedHandler } from "../../../src/processors/registry/handlers/index.js";

describe("ProfileCreatedHandler", () => {
    let mockEvent: ProcessorEvent<"Registry", "ProfileCreated">;
    let mockChainId: ChainId;
    let mockDependencies: ProcessorDependencies;
    const mockedTxHash = "0x6e5a7115323ac1712f7c27adff46df2216324a4ad615a8c9ce488c32a1f3a035";
    const mockedAddress = "0x48f33AE41E1762e1688125C4f1C536B1491dF803";
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    beforeEach(() => {
        mockEvent = {
            blockTimestamp: 123123123 as TimestampMs,
            chainId: 10 as ChainId,
            contractName: "Registry",
            eventName: "ProfileCreated",
            logIndex: 10,
            srcAddress: mockedAddress,
            transactionFields: {
                hash: mockedTxHash,
                transactionIndex: 10,
            },
            blockNumber: 123,
            params: {
                profileId: "0x1231231234" as Bytes32String,
                metadata: ["1", "cid-metadata"],
                name: "Test Project",
                nonce: "1",
                anchor: mockedAddress,
                owner: mockedAddress,
            },
        } as ProcessorEvent<"Registry", "ProfileCreated">;

        mockChainId = 10 as ChainId;

        mockDependencies = {
            projectRepository: {
                getPendingProjectRolesByRole: vi.fn().mockResolvedValue([]),
            } as unknown as IProjectReadRepository,
            evmProvider: {
                getTransaction: vi.fn().mockResolvedValue({ from: mockedAddress }),
            } as unknown as EvmProvider,
            pricingProvider: {
                getTokenPrice: vi.fn(),
            } as unknown as IPricingProvider,
            metadataProvider: {
                getMetadata: vi.fn(),
            } as unknown as IMetadataProvider,
            roundRepository: {} as unknown as IRoundReadRepository,
            applicationRepository: {} as unknown as IApplicationReadRepository,
            logger,
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("handles ProfileCreated event and return the correct changeset", async () => {
        (mockDependencies.metadataProvider.getMetadata as Mock).mockResolvedValueOnce({
            type: "program",
            name: "Test Project",
        });
        const profileCreatedHandler = new ProfileCreatedHandler(
            mockEvent,
            mockChainId,
            mockDependencies,
        );

        const result = await profileCreatedHandler.handle();

        expect(result).toEqual([
            {
                type: "InsertProject",
                args: {
                    project: {
                        tags: ["allo-v2", "program"],
                        chainId: mockChainId,
                        registryAddress: mockEvent.srcAddress,
                        id: mockEvent.params.profileId,
                        name: "Test Project",
                        nonce: 1n,
                        anchorAddress: mockEvent.params.anchor,
                        projectNumber: null,
                        metadataCid: mockEvent.params.metadata[1],
                        metadata: { type: "program", name: "Test Project" },
                        createdByAddress: mockEvent.srcAddress,
                        createdAtBlock: BigInt(123),
                        updatedAtBlock: BigInt(123),
                        projectType: "canonical",
                        timestamp: new Date(mockEvent.blockTimestamp),
                    },
                },
            },
            {
                type: "InsertProjectRole",
                args: {
                    projectRole: {
                        chainId: mockChainId,
                        projectId: mockEvent.params.profileId,
                        address: mockEvent.params.owner,
                        role: "owner",
                        createdAtBlock: BigInt(123),
                    },
                },
            },
        ]);

        expect(
            mockDependencies.projectRepository.getPendingProjectRolesByRole,
        ).toHaveBeenCalledWith(mockChainId, mockEvent.params.profileId);
        expect(mockDependencies.evmProvider.getTransaction).toHaveBeenCalledWith(
            mockEvent.transactionFields.hash,
        );
        expect(mockDependencies.metadataProvider.getMetadata).toHaveBeenCalledWith(
            mockEvent.params.metadata[1],
        );
    });

    it.skip("logs a warning if metadata parsing fails", async () => {
        (mockDependencies.metadataProvider.getMetadata as Mock).mockResolvedValueOnce({
            invalid: "data",
        });

        const handler = new ProfileCreatedHandler(mockEvent, mockChainId, mockDependencies);
        const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await handler.handle();

        expect(consoleWarnSpy).toHaveBeenCalledWith({
            msg: `ProfileCreated: Failed to parse metadata for profile ${mockEvent.params.profileId}`,
            event: mockEvent,
            metadataCid: "cid-metadata",
            metadata: { invalid: "data" },
        });
    });

    it("returns an null metadata on changeset parsing fails", async () => {
        (mockDependencies.metadataProvider.getMetadata as Mock).mockResolvedValueOnce({
            invalid: "data",
        });

        const handler = new ProfileCreatedHandler(mockEvent, mockChainId, mockDependencies);

        const result = await handler.handle();

        expect(mockDependencies.metadataProvider.getMetadata).toHaveBeenCalledWith(
            mockEvent.params.metadata[1],
        );
        expect(mockDependencies.evmProvider.getTransaction).toHaveBeenCalledWith(
            mockEvent.transactionFields.hash,
        );
        expect(result).toEqual([
            {
                type: "InsertProject",
                args: {
                    project: {
                        tags: ["allo-v2"],
                        chainId: mockChainId,
                        registryAddress: mockEvent.srcAddress,
                        id: mockEvent.params.profileId,
                        name: "Test Project",
                        nonce: 1n,
                        anchorAddress: mockEvent.params.anchor,
                        projectNumber: null,
                        metadataCid: mockEvent.params.metadata[1],
                        metadata: null,
                        createdByAddress: mockEvent.srcAddress,
                        createdAtBlock: BigInt(123),
                        updatedAtBlock: BigInt(123),
                        projectType: "canonical",
                        timestamp: new Date(mockEvent.blockTimestamp),
                    },
                },
            },
            {
                type: "InsertProjectRole",
                args: {
                    projectRole: {
                        chainId: mockChainId,
                        projectId: mockEvent.params.profileId,
                        address: mockEvent.params.owner,
                        role: "owner",
                        createdAtBlock: BigInt(123),
                    },
                },
            },
        ]);
    });

    it("includes pending project roles in the changeset", async () => {
        (
            mockDependencies.projectRepository.getPendingProjectRolesByRole as Mock
        ).mockResolvedValueOnce([{ id: "1", address: mockedAddress }]);

        const handler = new ProfileCreatedHandler(mockEvent, mockChainId, mockDependencies);
        const result = await handler.handle();

        expect(result).toContainEqual({
            type: "InsertProjectRole",
            args: {
                projectRole: {
                    chainId: mockChainId,
                    projectId: mockEvent.params.profileId,
                    address: getAddress(mockedAddress),
                    role: "member",
                    createdAtBlock: BigInt(123),
                },
            },
        });
        expect(result).toContainEqual({
            type: "DeletePendingProjectRoles",
            args: { ids: ["1"] },
        });
    });

    it("throws an error if getTransaction fails", async () => {
        (mockDependencies.evmProvider.getTransaction as Mock).mockRejectedValueOnce(
            new Error("Transaction not found"),
        );

        const handler = new ProfileCreatedHandler(mockEvent, mockChainId, mockDependencies);

        await expect(handler.handle()).rejects.toThrow("Transaction not found");
        expect(mockDependencies.evmProvider.getTransaction).toHaveBeenCalledWith(
            mockEvent.transactionFields.hash,
        );
    });

    it("processes valid metadata successfully", async () => {
        (mockDependencies.metadataProvider.getMetadata as Mock).mockResolvedValueOnce({
            canonical: {
                registryAddress: "0x1234567890abcdef",
                chainId: 1,
            },
        });

        const handler = new ProfileCreatedHandler(mockEvent, mockChainId, mockDependencies);

        const result = await handler.handle();

        expect(result).toContainEqual({
            type: "InsertProject",
            args: {
                project: {
                    tags: ["allo-v2"],
                    chainId: mockChainId,
                    registryAddress: getAddress(mockEvent.srcAddress),
                    id: mockEvent.params.profileId,
                    name: "Test Project",
                    nonce: 1n,
                    anchorAddress: getAddress(mockEvent.params.anchor),
                    projectNumber: null,
                    metadataCid: mockEvent.params.metadata[1],
                    metadata: {
                        type: "project",
                        canonical: {
                            registryAddress: "0x1234567890abcdef",
                            chainId: 1,
                        },
                    },
                    createdByAddress: getAddress(mockedAddress),
                    createdAtBlock: BigInt(mockEvent.blockNumber),
                    updatedAtBlock: BigInt(mockEvent.blockNumber),
                    projectType: "linked", // As the metadata contains canonical, it should be "linked"
                    timestamp: new Date(mockEvent.blockTimestamp),
                },
            },
        });
    });

    it("returns correct changeset without pending roles", async () => {
        (mockDependencies.metadataProvider.getMetadata as Mock).mockResolvedValueOnce({
            canonical: {
                registryAddress: "0x1234567890abcdef",
                chainId: 1,
            },
        });

        (
            mockDependencies.projectRepository.getPendingProjectRolesByRole as Mock
        ).mockResolvedValueOnce([]);

        const handler = new ProfileCreatedHandler(mockEvent, mockChainId, mockDependencies);
        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "InsertProject",
                args: {
                    project: {
                        tags: ["allo-v2"],
                        chainId: mockChainId,
                        registryAddress: getAddress(mockEvent.srcAddress),
                        id: mockEvent.params.profileId,
                        name: "Test Project",
                        nonce: 1n,
                        anchorAddress: getAddress(mockEvent.params.anchor),
                        projectNumber: null,
                        metadataCid: mockEvent.params.metadata[1],
                        metadata: {
                            type: "project",
                            canonical: {
                                registryAddress: "0x1234567890abcdef",
                                chainId: 1,
                            },
                        },
                        createdByAddress: getAddress(mockedAddress),
                        createdAtBlock: BigInt(mockEvent.blockNumber),
                        updatedAtBlock: BigInt(mockEvent.blockNumber),
                        projectType: "linked", // As the metadata contains canonical, it should be "linked"
                        timestamp: new Date(mockEvent.blockTimestamp),
                    },
                },
            },
            {
                type: "InsertProjectRole",
                args: {
                    projectRole: {
                        chainId: mockChainId,
                        projectId: mockEvent.params.profileId,
                        address: getAddress(mockEvent.params.owner),
                        role: "owner",
                        createdAtBlock: BigInt(mockEvent.blockNumber),
                    },
                },
            },
        ]);

        expect(
            mockDependencies.projectRepository.getPendingProjectRolesByRole,
        ).toHaveBeenCalledWith(mockChainId, mockEvent.params.profileId);
        expect(mockDependencies.metadataProvider.getMetadata).toHaveBeenCalledWith(
            mockEvent.params.metadata[1],
        );
        expect(mockDependencies.evmProvider.getTransaction).toHaveBeenCalledWith(
            mockEvent.transactionFields.hash,
        );
    });

    it("throws when metadata provider fails", async () => {
        (mockDependencies.metadataProvider.getMetadata as Mock).mockRejectedValueOnce(
            new Error("Failed to fetch metadata"),
        );

        const handler = new ProfileCreatedHandler(mockEvent, mockChainId, mockDependencies);

        await expect(handler.handle()).rejects.toThrow("Failed to fetch metadata");
        expect(mockDependencies.metadataProvider.getMetadata).toHaveBeenCalledWith(
            mockEvent.params.metadata[1],
        );
    });
});
