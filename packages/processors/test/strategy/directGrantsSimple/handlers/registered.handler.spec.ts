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
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { DGSimpleRegisteredHandler } from "../../../../src/processors/strategy/directGrantsSimple/handlers/registered.handler.js";
import { createMockEvent } from "../../../mocks/index.js";

describe("DGSimpleRegisteredHandler", () => {
    let handler: DGSimpleRegisteredHandler;
    let mockRoundRepository: IRoundRepository;
    let mockProjectRepository: IProjectRepository;
    let mockMetadataProvider: IMetadataProvider;
    let mockEvent: ProcessorEvent<"Strategy", "RegisteredWithSender">;
    const chainId = 10 as ChainId;
    const eventName = "RegisteredWithSender";
    const defaultParams = {
        recipientId: "0x1234567890123456789012345678901234567890",
        data: "0x0000000000000000000000001234567890123456789012345678901234567890000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000",
        sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
                            updatedAt: new Date(mockEvent.blockTimestamp),
                        },
                    ],
                    distributionTransaction: null,
                    totalAmountDonatedInUsd: "0",
                    totalDonationsCount: 0,
                    uniqueDonorsCount: 0,
                    tags: ["allo-v2"],
                    timestamp: new Date(mockEvent.blockTimestamp),
                },
            },
        ]);
    });

    it("throws ProjectNotFound if project is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
