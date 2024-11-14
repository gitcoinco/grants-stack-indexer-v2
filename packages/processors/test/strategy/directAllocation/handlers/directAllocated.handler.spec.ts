import { getAddress, parseEther, zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    IProjectReadRepository,
    IRoundReadRepository,
    Project,
    ProjectNotFound,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import {
    Bytes32String,
    ChainId,
    DeepPartial,
    ILogger,
    mergeDeep,
    ProcessorEvent,
} from "@grants-stack-indexer/shared";

import { TokenPriceNotFoundError } from "../../../../src/exceptions/index.js";
import { getDonationId } from "../../../../src/processors/strategy/helpers/index.js";
import { DirectAllocatedHandler } from "../../../../src/processors/strategy/index.js";

function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"Strategy", "DirectAllocated">> = {},
): ProcessorEvent<"Strategy", "DirectAllocated"> {
    const defaultEvent: ProcessorEvent<"Strategy", "DirectAllocated"> = {
        params: {
            profileId: "0x1234567890123456789012345678901234567890" as Bytes32String,
            profileOwner: "0x1234567890123456789012345678901234567890",
            amount: parseEther("10").toString(),
            token: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            sender: "0x1234567890123456789012345678901234567890",
        },
        eventName: "DirectAllocated",
        srcAddress: "0x1234567890123456789012345678901234567890",
        blockNumber: 118034410,
        blockTimestamp: 1000000000,
        chainId: 10 as ChainId,
        contractName: "Strategy",
        logIndex: 92,
        transactionFields: {
            hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
            transactionIndex: 6,
            from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        strategyId: "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0",
    };

    return mergeDeep(defaultEvent, overrides);
}

describe("DirectAllocatedHandler", () => {
    let handler: DirectAllocatedHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockProjectRepository: IProjectReadRepository;
    let mockPricingProvider: IPricingProvider;
    let mockEvent: ProcessorEvent<"Strategy", "DirectAllocated">;
    let mockLogger: ILogger;
    const chainId = 10 as ChainId;

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundReadRepository;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
        } as IPricingProvider;
        mockProjectRepository = {
            getProjectByIdOrThrow: vi.fn(),
        } as unknown as IProjectReadRepository;
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        } as unknown as ILogger;
    });

    it("handles a valid direct allocation event", async () => {
        const amount = parseEther("10").toString();
        mockEvent = createMockEvent({ params: { amount } });
        const mockRound = {
            id: "round1",
        } as unknown as Round;

        const mockProject = {
            id: mockEvent.params.profileId,
        } as unknown as Project;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockProjectRepository, "getProjectByIdOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            timestampMs: mockEvent.blockTimestamp,
            priceUsd: 2000,
        });

        handler = new DirectAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            pricingProvider: mockPricingProvider,
            logger: mockLogger,
        });

        const donationId = getDonationId(mockEvent.blockNumber, mockEvent.logIndex);

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "InsertDonation",
                args: {
                    donation: {
                        id: donationId,
                        chainId,
                        roundId: mockRound.id,
                        applicationId: zeroAddress,
                        projectId: mockEvent.params.profileId,
                        donorAddress: getAddress(mockEvent.params.sender),
                        recipientAddress: getAddress(mockEvent.params.profileOwner),
                        transactionHash: mockEvent.transactionFields.hash,
                        blockNumber: BigInt(mockEvent.blockNumber),
                        tokenAddress: getAddress(mockEvent.params.token),
                        amount: BigInt(amount),
                        amountInUsd: "20000",
                        amountInRoundMatchToken: 0n,
                        timestamp: new Date(mockEvent.blockTimestamp),
                    },
                },
            },
        ]);
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent();
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.srcAddress),
        );

        handler = new DirectAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            pricingProvider: mockPricingProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });

    it("throws ProjectNotFound if project is not found", async () => {
        mockEvent = createMockEvent();
        const mockRound = {
            id: mockEvent.params.profileId,
            matchTokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        } as unknown as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockProjectRepository, "getProjectByIdOrThrow").mockRejectedValue(
            new ProjectNotFound(chainId, mockEvent.params.profileId),
        );

        handler = new DirectAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            pricingProvider: mockPricingProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(ProjectNotFound);
    });

    it("throws TokenPriceNotFoundError if token price is not found", async () => {
        mockEvent = createMockEvent();
        const mockRound = {
            id: "round1",
        } as unknown as Round;
        const mockProject = {
            id: "project1",
        } as Project;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockProjectRepository, "getProjectByIdOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue(undefined);

        handler = new DirectAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            pricingProvider: mockPricingProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(TokenPriceNotFoundError);
    });
});
