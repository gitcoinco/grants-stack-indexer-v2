import { getAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import {
    IProjectRepository,
    IRoundRepository,
    Project,
    ProjectNotFound,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import { ChainId, DeepPartial, mergeDeep, ProcessorEvent } from "@grants-stack-indexer/shared";

import { DGSimpleRegisteredHandler } from "../../../../src/processors/strategy/directGrantsSimple/handlers/registered.handler.js";

function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"Strategy", "RegisteredWithSender">> = {},
): ProcessorEvent<"Strategy", "RegisteredWithSender"> {
    const defaultEvent: ProcessorEvent<"Strategy", "RegisteredWithSender"> = {
        params: {
            recipientId: "0x1234567890123456789012345678901234567890",
            data: "0x0000000000000000000000001234567890123456789012345678901234567890000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000",
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

describe("DGSimpleRegisteredHandler", () => {
    let handler: DGSimpleRegisteredHandler;
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
        } as Project;
        const mockRound = { id: "round1" } as Round;
        const mockMetadata = { name: "Test Project" };

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(mockMetadata);

        handler = new DGSimpleRegisteredHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "InsertApplication",
                args: {
                    chainId,
                    id: mockEvent.params.recipientId,
                    projectId: "project1",
                    anchorAddress: getAddress(mockEvent.params.recipientId),
                    roundId: "round1",
                    status: "PENDING",
                    metadataCid: "bafkreigyc43cfinxlnahq5aawsghibetv6usrs7kkxf7vxmzbjyro76iwy",
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
    });

    it("throws ProjectNotFound if project is not found", async () => {
        mockEvent = createMockEvent();
        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockRejectedValue(
            new ProjectNotFound(chainId, mockEvent.params.recipientId),
        );

        handler = new DGSimpleRegisteredHandler(mockEvent, chainId, {
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
        } as Project;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new DGSimpleRegisteredHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });

    it("handles undefined metadata", async () => {
        mockEvent = createMockEvent();
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as Project;
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(null);

        handler = new DGSimpleRegisteredHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
        });

        const result = await handler.handle();
        const changeset = result[0] as {
            type: "InsertApplication";
            args: { metadata: null };
        };
        expect(changeset.args.metadata).toBeNull();
    });
});
