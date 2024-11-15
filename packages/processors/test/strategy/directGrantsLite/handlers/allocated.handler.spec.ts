import { getAddress, pad, parseEther } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    Application,
    ApplicationNotFound,
    IApplicationRepository,
    IRoundRepository,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import {
    ChainId,
    DeepPartial,
    mergeDeep,
    ProcessorEvent,
    UnknownToken,
} from "@grants-stack-indexer/shared";

import { TokenPriceNotFoundError } from "../../../../src/exceptions/tokenPriceNotFound.exception.js";
import { DGLiteAllocatedHandler } from "../../../../src/processors/strategy/directGrantsLite/handlers/allocated.handler.js";

function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"Strategy", "AllocatedWithToken">> = {},
): ProcessorEvent<"Strategy", "AllocatedWithToken"> {
    const defaultEvent: ProcessorEvent<"Strategy", "AllocatedWithToken"> = {
        params: {
            recipientId: "0x1234567890123456789012345678901234567890",
            amount: parseEther("10").toString(),
            token: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        eventName: "AllocatedWithToken",
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

describe("DGLiteAllocatedHandler", () => {
    let handler: DGLiteAllocatedHandler;
    let mockRoundRepository: IRoundRepository;
    let mockApplicationRepository: IApplicationRepository;
    let mockPricingProvider: IPricingProvider;
    let mockEvent: ProcessorEvent<"Strategy", "AllocatedWithToken">;
    const chainId = 10 as ChainId;

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundRepository;
        mockApplicationRepository = {
            getApplicationByAnchorAddressOrThrow: vi.fn(),
        } as unknown as IApplicationRepository;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
        } as IPricingProvider;
    });

    it("handles a valid allocation event", async () => {
        const amount = parseEther("10").toString();
        mockEvent = createMockEvent({ params: { amount } });
        const mockRound = {
            id: "round1",
            matchTokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            matchAmount: BigInt(0),
            matchAmountInUsd: "0",
            fundedAmount: BigInt(0),
            fundedAmountInUsd: "0",
            totalAmountDonatedInUsd: "0",
            totalDonationsCount: 0,
            uniqueDonorsCount: 0,
            tags: [],
        } as unknown as Round;

        const mockApplication = {
            id: "app1",
            projectId: "project1",
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            timestampMs: 1000000000,
            priceUsd: 2000,
        });

        handler = new DGLiteAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        const result = await handler.handle();

        expect(result[0]).toEqual({
            type: "InsertApplicationPayout",
            args: {
                applicationPayout: {
                    amount: BigInt(amount),
                    applicationId: "app1",
                    roundId: "round1",
                    chainId,
                    tokenAddress: getAddress(mockEvent.params.token),
                    amountInRoundMatchToken: BigInt(amount),
                    amountInUsd: "20000",
                    transactionHash: mockEvent.transactionFields.hash,
                    sender: getAddress(mockEvent.params.sender),
                    timestamp: new Date(mockEvent.blockTimestamp),
                },
            },
        });
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent();
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new DGLiteAllocatedHandler(mockEvent, chainId, {
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
            chainId,
            matchTokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            matchAmount: BigInt(0),
            matchAmountInUsd: "0",
            fundedAmount: BigInt(0),
            fundedAmountInUsd: "0",
            totalAmountDonatedInUsd: "0",
            totalDonationsCount: 0,
            uniqueDonorsCount: 0,
            tags: [],
        } as unknown as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockRejectedValue(
            new ApplicationNotFound(chainId, mockRound.id, mockEvent.params.recipientId),
        );

        handler = new DGLiteAllocatedHandler(mockEvent, chainId, {
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

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);

        handler = new DGLiteAllocatedHandler(mockEvent, chainId, {
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

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);

        handler = new DGLiteAllocatedHandler(mockEvent, chainId, {
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

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue(undefined);

        handler = new DGLiteAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(TokenPriceNotFoundError);
    });

    it("handles different token and match token", async () => {
        const amount = parseEther("10").toString();
        mockEvent = createMockEvent({ params: { amount } });
        const mockRound = {
            id: "round1",
            chainId,
            matchTokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            matchAmount: BigInt(0),
            matchAmountInUsd: "0",
            fundedAmount: BigInt(0),
            fundedAmountInUsd: "0",
            totalAmountDonatedInUsd: "0",
            totalDonationsCount: 0,
            uniqueDonorsCount: 0,
            tags: [],
        } as unknown as Round;

        const mockApplication = {
            id: "app1",
            projectId: "project1",
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);
        vi.spyOn(mockPricingProvider, "getTokenPrice")
            .mockResolvedValueOnce({
                timestampMs: 1000000000,
                priceUsd: 1,
            })
            .mockResolvedValueOnce({
                timestampMs: 1000000000,
                priceUsd: 2000,
            });

        handler = new DGLiteAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        const result = await handler.handle();
        const changeset = result[0] as {
            type: "InsertApplicationPayout";
            args: { applicationPayout: { amountInRoundMatchToken: bigint } };
        };
        expect(changeset.args.applicationPayout.amountInRoundMatchToken).toBe(parseEther("0.005"));
    });
});
