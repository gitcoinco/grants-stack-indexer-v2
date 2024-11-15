import { getAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import {
    IProjectRepository,
    IRoundRepository,
    NewApplication,
    Project,
    ProjectNotFound,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import { ChainId, DeepPartial, mergeDeep, ProcessorEvent } from "@grants-stack-indexer/shared";

import { DGLiteRegisteredHandler } from "../../../../src/processors/strategy/directGrantsLite/handlers/registered.handler.js";

function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"Strategy", "RegisteredWithSender">> = {},
): ProcessorEvent<"Strategy", "RegisteredWithSender"> {
    const defaultEvent: ProcessorEvent<"Strategy", "RegisteredWithSender"> = {
        params: {
            recipientId: "0x1234567890123456789012345678901234567890",
            data: "0x000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000100000000000000000000000000accc041f3d1f576198ac88ede32e58c3476710a700000000000000000000000058338e95caef17861916ef10dad5fafe20421005000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656966736e77736a6c6b74746632626d6f646a6c646e76766c366677707271766a6976786b67367a6e74376a656c62786a75717a33650000000000",
            sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        eventName: "RegisteredWithSender",
        srcAddress: "0x1234567890123456789012345678901234567890",
        blockNumber: 12345,
        blockTimestamp: 1000000000,
        chainId: 10 as ChainId,
        contractName: "Strategy",
        logIndex: 1,
        transactionFields: {
            hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
            transactionIndex: 6,
            from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        strategyId: "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0",
    };

    return mergeDeep(defaultEvent, overrides);
}

describe("DGLiteRegisteredHandler", () => {
    let handler: DGLiteRegisteredHandler;
    let mockRoundRepository: IRoundRepository;
    let mockProjectRepository: IProjectRepository;
    let mockMetadataProvider: IMetadataProvider;
    let mockEvent: ProcessorEvent<"Strategy", "RegisteredWithSender">;
    const chainId = 10 as ChainId;

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundRepository;
        mockProjectRepository = {
            getProjectByAnchorOrThrow: vi.fn(),
        } as unknown as IProjectRepository;
        mockMetadataProvider = {
            getMetadata: vi.fn(),
        } as unknown as IMetadataProvider;
    });

    it("handles a valid registration event", async () => {
        mockEvent = createMockEvent();
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as unknown as Project;
        const mockRound = {
            id: "round1",
            chainId,
        } as unknown as Round;
        const mockMetadata = { name: "Test Project" };

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(mockMetadata);

        handler = new DGLiteRegisteredHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
        });

        const result = await handler.handle();

        // parsed data:
        // {
        //     anchorAddress: '0xAcCC041f3D1F576198AC88eDE32E58C3476710A7',
        //     recipientAddress: '0x58338E95caEf17861916Ef10daD5fAFE20421005',
        //     metadata: {
        //       protocol: 1,
        //       pointer: 'bafkreifsnwsjlkttf2bmodjldnvvl6fwprqvjivxkg6znt7jelbxjuqz3e'
        //     },
        //     recipientsCounter: '2'
        //   }

        expect(result).toEqual([
            {
                type: "InsertApplication",
                args: {
                    chainId,
                    id: "1",
                    projectId: "project1",
                    anchorAddress: getAddress(mockEvent.params.recipientId),
                    roundId: "round1",
                    status: "PENDING",
                    metadataCid: "bafkreifsnwsjlkttf2bmodjldnvvl6fwprqvjivxkg6znt7jelbxjuqz3e",
                    metadata: mockMetadata,
                    createdAtBlock: BigInt(mockEvent.blockNumber),
                    createdByAddress: getAddress(mockEvent.params.sender),
                    statusUpdatedAtBlock: BigInt(mockEvent.blockNumber),
                    statusSnapshots: [
                        {
                            status: "PENDING",
                            updatedAtBlock: mockEvent.blockNumber.toString(),
                            updatedAt: new Date(mockEvent.blockTimestamp * 1000),
                        },
                    ],
                    distributionTransaction: null,
                    totalAmountDonatedInUsd: 0,
                    totalDonationsCount: 0,
                    uniqueDonorsCount: 0,
                    tags: ["allo-v2"],
                },
            },
        ]);

        expect(mockMetadataProvider.getMetadata).toHaveBeenCalledWith(
            "bafkreifsnwsjlkttf2bmodjldnvvl6fwprqvjivxkg6znt7jelbxjuqz3e",
        );
    });

    it("handles null metadata", async () => {
        mockEvent = createMockEvent();
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as unknown as Project;
        const mockRound = {
            id: "round1",
            chainId,
        } as unknown as Round;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(null);

        handler = new DGLiteRegisteredHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
        });

        const result = await handler.handle();
        expect(result).toHaveLength(1);
        const changeset = result[0] as {
            type: "InsertApplication";
            args: NewApplication;
        };
        expect(changeset.args.metadata).toBeNull();
    });

    it("throws ProjectNotFound if project is not found", async () => {
        mockEvent = createMockEvent();
        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockRejectedValue(
            new ProjectNotFound(chainId, mockEvent.params.recipientId),
        );

        handler = new DGLiteRegisteredHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
        });

        await expect(handler.handle()).rejects.toThrow(ProjectNotFound);
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent();
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as unknown as Project;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new DGLiteRegisteredHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });
});
