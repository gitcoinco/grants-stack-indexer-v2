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
import { ChainId, ProcessorEvent, TimestampMs, UnknownToken } from "@grants-stack-indexer/shared";

import { TokenPriceNotFoundError } from "../../../../src/exceptions/tokenPriceNotFound.exception.js";
import { DGLiteAllocatedHandler } from "../../../../src/processors/strategy/directGrantsLite/handlers/allocated.handler.js";
import { createMockEvent } from "../../../mocks/index.js";

describe("DGLiteAllocatedHandler", () => {
    let handler: DGLiteAllocatedHandler;
    let mockRoundRepository: IRoundRepository;
    let mockApplicationRepository: IApplicationRepository;
    let mockPricingProvider: IPricingProvider;
    let mockEvent: ProcessorEvent<"Strategy", "AllocatedWithToken">;
    const chainId = 10 as ChainId;
    const eventName = "AllocatedWithToken";
    const defaultParams = {
        recipientId: "0x1234567890123456789012345678901234567890",
        amount: parseEther("10").toString(),
        token: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundRepository;
        mockApplicationRepository = {
            getApplicationByAnchorAddressOrThrow: vi.fn(),
        } as unknown as IApplicationRepository;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
            getTokenPrices: vi.fn(),
        } as IPricingProvider;
    });

    it("handles a valid allocation event", async () => {
        const amount = parseEther("10").toString();
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: { amount },
        });
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
            timestampMs: 1000000000 as TimestampMs,
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

        expect(result[1]).toEqual({
            type: "IncrementRoundTotalDistributed",
            args: {
                chainId,
                roundId: "round1",
                amount: BigInt(amount),
            },
        });
    });

    it("doesn't fetch token price if amount is 0", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: { amount: "0" },
        });
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

        handler = new DGLiteAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        const result = await handler.handle();
        const changeset = result[0] as {
            type: "InsertApplicationPayout";
            args: {
                applicationPayout: {
                    amount: bigint;
                    amountInUsd: string;
                    amountInRoundMatchToken: bigint;
                };
            };
        };

        expect(mockPricingProvider.getTokenPrice).not.toHaveBeenCalled();
        expect(changeset.args.applicationPayout.amount).toBe(0n);
        expect(changeset.args.applicationPayout.amountInUsd).toBe("0");
        expect(changeset.args.applicationPayout.amountInRoundMatchToken).toBe(0n);

        expect(result[1]).toEqual({
            type: "IncrementRoundTotalDistributed",
            args: {
                chainId,
                roundId: "round1",
                amount: BigInt(0),
            },
        });
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: { amount },
        });
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
                timestampMs: 1000000000 as TimestampMs,
                priceUsd: 1,
            })
            .mockResolvedValueOnce({
                timestampMs: 1000000000 as TimestampMs,
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
        expect(result[1]).toEqual({
            type: "IncrementRoundTotalDistributed",
            args: {
                chainId,
                roundId: "round1",
                amount: parseEther("0.005"),
            },
        });
    });
});
