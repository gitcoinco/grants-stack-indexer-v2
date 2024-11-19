import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import {
    IProjectReadRepository,
    IRoundReadRepository,
    NewApplication,
    Project,
    ProjectNotFound,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { DVMDRegisteredHandler } from "../../../../src/processors/strategy/donationVotingMerkleDistributionDirectTransfer/handlers/index.js";
import { createMockEvent } from "../../../mocks/index.js";

// function createMockEvent(
//     overrides: DeepPartial<ProcessorEvent<"Strategy", "RegisteredWithSender">> = {},
// ): ProcessorEvent<"Strategy", "RegisteredWithSender"> {
//     const defaultEvent: ProcessorEvent<"Strategy", "RegisteredWithSender"> = {
//         params: {
//             recipientId: "0x1234567890123456789012345678901234567890",
//             sender: "0x0987654321098765432109876543210987654321",
//             data: "0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001000000000000000000000000002c7296a5ec0539f0a018c7176c97c92a9c44e2b4000000000000000000000000e7eb5d2b5b188777df902e89c54570e7ef4f59ce000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000",
//         },
//         eventName: "RegisteredWithSender",
//         srcAddress: "0x1234567890123456789012345678901234567890",
//         blockNumber: 12345,
//         blockTimestamp: 1000000000,
//         chainId: 10 as ChainId,
//         contractName: "Strategy",
//         logIndex: 1,
//         transactionFields: {
//             hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
//             transactionIndex: 6,
//             from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
//         },
//         strategyId: "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0",
//     };

//     return mergeDeep(defaultEvent, overrides) as ProcessorEvent<"Strategy", "RegisteredWithSender">;
// }

describe("DVMDRegisteredHandler", () => {
    let handler: DVMDRegisteredHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockProjectRepository: IProjectReadRepository;
    let mockMetadataProvider: IMetadataProvider;
    let mockEvent: ProcessorEvent<"Strategy", "RegisteredWithSender">;
    const chainId = 10 as ChainId;
    const eventName = "RegisteredWithSender";
    const defaultParams = {
        recipientId: "0x1234567890123456789012345678901234567890",
        sender: "0x0987654321098765432109876543210987654321",
        data: "0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001000000000000000000000000002c7296a5ec0539f0a018c7176c97c92a9c44e2b4000000000000000000000000e7eb5d2b5b188777df902e89c54570e7ef4f59ce000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundReadRepository;
        mockProjectRepository = {
            getProjectByAnchorOrThrow: vi.fn(),
        } as unknown as IProjectReadRepository;
        mockMetadataProvider = {
            getMetadata: vi.fn(),
        } as unknown as IMetadataProvider;
    });

    it("handle a valid registration event", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockProject = { id: "project1" } as Project;
        const mockRound = { id: "round1" } as Round;
        const mockMetadata = { name: "Test Project" };

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(mockMetadata);

        handler = new DVMDRegisteredHandler(mockEvent, chainId, {
            projectRepository: mockProjectRepository,
            roundRepository: mockRoundRepository,
            metadataProvider: mockMetadataProvider,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "InsertApplication",
                args: {
                    chainId,
                    id: "0",
                    projectId: "project1",
                    anchorAddress: "0x1234567890123456789012345678901234567890",
                    roundId: "round1",
                    status: "PENDING",
                    metadataCid: "bafkreigyc43cfinxlnahq5aawsghibetv6usrs7kkxf7vxmzbjyro76iwy",
                    metadata: mockMetadata,
                    createdAtBlock: BigInt(mockEvent.blockNumber),
                    createdByAddress: "0x0987654321098765432109876543210987654321",
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

    it("throw ProjectNotFound if project is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockRejectedValue(
            new ProjectNotFound(chainId, mockEvent.srcAddress),
        );

        handler = new DVMDRegisteredHandler(mockEvent, chainId, {
            projectRepository: mockProjectRepository,
            roundRepository: mockRoundRepository,
            metadataProvider: mockMetadataProvider,
        });
        await expect(handler.handle()).rejects.toThrow(ProjectNotFound);
    });

    it("throw RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockProject = { id: "project1" } as Project;
        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new DVMDRegisteredHandler(mockEvent, chainId, {
            projectRepository: mockProjectRepository,
            roundRepository: mockRoundRepository,
            metadataProvider: mockMetadataProvider,
        });
        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });

    it("handle registration with null metadata", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockProject = { id: "project1" } as Project;
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(undefined);

        handler = new DVMDRegisteredHandler(mockEvent, chainId, {
            projectRepository: mockProjectRepository,
            roundRepository: mockRoundRepository,
            metadataProvider: mockMetadataProvider,
        });
        const result = await handler.handle();

        const changeset = result[0] as { type: "InsertApplication"; args: NewApplication };
        expect(result).toBeDefined();
        expect(changeset.args.metadata).toBeNull();
    });

    it("correctly calculate application ID based on recipientsCounter", async () => {
        // recipientsCounter = 5
        const mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: {
                data: "0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000001000000000000000000000000002c7296a5ec0539f0a018c7176c97c92a9c44e2b4000000000000000000000000e7eb5d2b5b188777df902e89c54570e7ef4f59ce000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000",
            },
        });
        const mockProject = { id: "project1" } as Project;
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );

        handler = new DVMDRegisteredHandler(mockEvent, chainId, {
            projectRepository: mockProjectRepository,
            roundRepository: mockRoundRepository,
            metadataProvider: mockMetadataProvider,
        });
        const result = await handler.handle();

        const changeset = result[0] as { type: "InsertApplication"; args: NewApplication };
        expect(changeset.args.id).toBe("4");
    });
});
