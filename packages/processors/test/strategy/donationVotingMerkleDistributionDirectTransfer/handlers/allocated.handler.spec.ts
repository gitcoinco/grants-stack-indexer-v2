import { getAddress, pad, parseEther } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    Application,
    IApplicationRepository,
    IRoundRepository,
    Round,
} from "@grants-stack-indexer/repository";
import { ChainId, DeepPartial, mergeDeep, ProcessorEvent } from "@grants-stack-indexer/shared";

import {
    ApplicationNotFound,
    MetadataParsingFailed,
    RoundNotFound,
    TokenPriceNotFoundError,
    UnknownToken,
} from "../../../../src/exceptions/index.js";
import { DVMDAllocatedHandler } from "../../../../src/strategy/donationVotingMerkleDistributionDirectTransfer/handlers/allocated.handler.js";

function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"Strategy", "AllocatedWithOrigin">> = {},
): ProcessorEvent<"Strategy", "AllocatedWithOrigin"> {
    const defaultEvent: ProcessorEvent<"Strategy", "AllocatedWithOrigin"> = {
        params: {
            recipientId: "0x1234567890123456789012345678901234567890",
            amount: 10n,
            token: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            origin: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
            sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        eventName: "AllocatedWithOrigin",
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

describe("DVMDAllocatedHandler", () => {
    let handler: DVMDAllocatedHandler;
    let mockRoundRepository: IRoundRepository;
    let mockApplicationRepository: IApplicationRepository;
    let mockPricingProvider: IPricingProvider;
    let mockEvent: ProcessorEvent<"Strategy", "AllocatedWithOrigin">;
    const chainId = 10 as ChainId;
    const expectedDonationId = "0x60077b059a7ca75483cf0651e209a0d5c14ad2afb1fd363c728f13680d24c546";

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddress: vi.fn(),
        } as unknown as IRoundRepository;
        mockApplicationRepository = {
            getApplicationByAnchorAddress: vi.fn(),
        } as unknown as IApplicationRepository;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
        } as IPricingProvider;
    });

    it("handle a valid allocated event", async () => {
        const amount = parseEther("10");
        mockEvent = createMockEvent({ params: { amount } });
        const mockRound = {
            id: "round1",
            matchTokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        } as unknown as Round;
        const mockApplication = {
            id: "app1",
            metadata: {
                application: {
                    round: "round1",
                    recipient: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
                },
            },
            projectId: "project1",
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(mockRound);
        vi.spyOn(mockApplicationRepository, "getApplicationByAnchorAddress").mockResolvedValue(
            mockApplication,
        );
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            timestampMs: 1000000000,
            priceUsd: 2000,
        });

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "InsertDonation",
                args: {
                    donation: {
                        id: expectedDonationId,
                        chainId,
                        roundId: "round1",
                        applicationId: "app1",
                        donorAddress: getAddress("0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5"),
                        recipientAddress: getAddress("0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5"),
                        projectId: "project1",
                        transactionHash: mockEvent.transactionFields.hash,
                        blockNumber: BigInt(mockEvent.blockNumber),
                        tokenAddress: getAddress("0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"),
                        amount: amount,
                        amountInUsd: "20000",
                        amountInRoundMatchToken: amount,
                        timestamp: new Date(1000000000),
                    },
                },
            },
        ]);
    });

    it("match token is different from event token", async () => {
        const amount = parseEther("1500");
        mockEvent = createMockEvent({ params: { amount } });
        const mockRound = {
            id: "round1",
            matchTokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        } as unknown as Round;
        const mockApplication = {
            id: "app1",
            metadata: {
                application: {
                    round: "round1",
                    recipient: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
                },
            },
            projectId: "project1",
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(mockRound);
        vi.spyOn(mockApplicationRepository, "getApplicationByAnchorAddress").mockResolvedValue(
            mockApplication,
        );
        vi.spyOn(mockPricingProvider, "getTokenPrice")
            .mockResolvedValueOnce({
                timestampMs: 1000000000,
                priceUsd: 1,
            })
            .mockResolvedValueOnce({
                timestampMs: 1000000000,
                priceUsd: 2000,
            });

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "InsertDonation",
                args: {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    donation: expect.objectContaining({
                        tokenAddress: getAddress("0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"),
                        amount: amount,
                        amountInUsd: "1500",
                        amountInRoundMatchToken: parseEther("0.75"),
                        timestamp: new Date(1000000000),
                    }),
                },
            },
        ]);
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent();
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(undefined);

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });

    it("throws ApplicationNotFound if application is not found", async () => {
        mockEvent = createMockEvent();
        const mockRound = {
            id: "round1",
            matchTokenAddress: "0x0987654321098765432109876543210987654321",
        } as unknown as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(mockRound);
        vi.spyOn(mockApplicationRepository, "getApplicationByAnchorAddress").mockResolvedValue(
            undefined,
        );

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(ApplicationNotFound);
    });

    it("throws UnknownToken if params token is not found", async () => {
        mockEvent = createMockEvent({
            params: { token: pad("0x1", { size: 20 }) },
        });
        const mockRound = {
            id: "round1",
            matchTokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        } as unknown as Round;
        const mockApplication = {
            id: "app1",
            metadata: {
                application: {
                    round: "round1",
                    recipient: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
                },
            },
            projectId: "project1",
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(mockRound);
        vi.spyOn(mockApplicationRepository, "getApplicationByAnchorAddress").mockResolvedValue(
            mockApplication,
        );

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(UnknownToken);
    });

    it("throws UnknownToken if match token is not found", async () => {
        mockEvent = createMockEvent();
        const mockRound = {
            id: "round1",
            matchTokenAddress: pad("0x1", { size: 20 }),
        } as unknown as Round;
        const mockApplication = {
            id: "app1",
            metadata: {
                application: {
                    round: "round1",
                    recipient: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
                },
            },
            projectId: "project1",
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(mockRound);
        vi.spyOn(mockApplicationRepository, "getApplicationByAnchorAddress").mockResolvedValue(
            mockApplication,
        );

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(UnknownToken);
    });

    it("throws TokenPriceNotFound if token price is not found", async () => {
        mockEvent = createMockEvent();
        const mockRound = {
            id: "round1",
            matchTokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        } as unknown as Round;
        const mockApplication = {
            id: "app1",
            metadata: {
                application: {
                    round: "round1",
                    recipient: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
                },
            },
            projectId: "project1",
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(mockRound);
        vi.spyOn(mockApplicationRepository, "getApplicationByAnchorAddress").mockResolvedValue(
            mockApplication,
        );
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue(undefined);

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(TokenPriceNotFoundError);
    });

    it("throws MetadataParsingFailed if metadata is invalid", async () => {
        mockEvent = createMockEvent();

        const mockRound = {
            id: "round1",
            matchTokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        } as unknown as Round;
        const mockApplication = {
            id: "app1",
            metadata: {
                application: {
                    recipient: 10n, // recipient is not a string
                },
            },
            projectId: "project1",
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(mockRound);
        vi.spyOn(mockApplicationRepository, "getApplicationByAnchorAddress").mockResolvedValue(
            mockApplication,
        );
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            timestampMs: 1000000000,
            priceUsd: 2000,
        });

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(MetadataParsingFailed);
    });
});
