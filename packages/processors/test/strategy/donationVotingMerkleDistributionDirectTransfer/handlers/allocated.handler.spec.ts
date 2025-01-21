import { getAddress, pad, parseEther } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    Application,
    ApplicationNotFound,
    Donation,
    IApplicationReadRepository,
    IRoundReadRepository,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent, UnknownToken } from "@grants-stack-indexer/shared";

import {
    MetadataParsingFailed,
    TokenPriceNotFoundError,
} from "../../../../src/exceptions/index.js";
import { DVMDAllocatedHandler } from "../../../../src/processors/strategy/donationVotingMerkleDistributionDirectTransfer/handlers/allocated.handler.js";
import { createMockEvent } from "../../../mocks/index.js";

describe("DVMDAllocatedHandler", () => {
    let handler: DVMDAllocatedHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockApplicationRepository: IApplicationReadRepository;
    let mockPricingProvider: IPricingProvider;
    let mockEvent: ProcessorEvent<"Strategy", "AllocatedWithOrigin">;
    const chainId = 10 as ChainId;
    const eventName = "AllocatedWithOrigin";
    const defaultParams = {
        recipientId: "0x1234567890123456789012345678901234567890",
        amount: "10",
        token: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        origin: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";
    const expectedDonationId = "0x86ec85686b02d646ee8a45f0770e85db890679ef7e5f962a51be056f32d54e15";

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundReadRepository;
        mockApplicationRepository = {
            getApplicationByAnchorAddressOrThrow: vi.fn(),
        } as unknown as IApplicationReadRepository;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
        } as unknown as IPricingProvider;
    });

    it("handle a valid allocated event", async () => {
        const amount = parseEther("10").toString();
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: { amount },
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
                        amount: BigInt(amount),
                        amountInUsd: "20000",
                        amountInRoundMatchToken: BigInt(amount),
                        timestamp: new Date(1000000000),
                    },
                },
            },
        ]);
    });

    it("match token is different from event token", async () => {
        const amount = parseEther("1500").toString();
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: { amount },
        });
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
                        amount: BigInt(amount),
                        amountInUsd: "1500",
                        amountInRoundMatchToken: parseEther("0.75"),
                        timestamp: new Date(1000000000),
                    }),
                },
            },
        ]);
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
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
            matchTokenAddress: "0x0987654321098765432109876543210987654321",
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

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
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

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
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

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
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

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(TokenPriceNotFoundError);
    });

    it("throws MetadataParsingFailed if metadata is invalid", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);

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

        handler = new DVMDAllocatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            pricingProvider: mockPricingProvider,
        });

        await expect(handler.handle()).rejects.toThrow(MetadataParsingFailed);
    });

    describe("Timestamp handling within DVMDAllocatedHandler", () => {
        const mockRound = {
            id: "round1",
            matchTokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        } as unknown as Round;

        const mockApplication = {
            id: "app1",
            projectId: "project1",
            metadata: {
                application: {
                    recipient: "0x1234567890123456789012345678901234567890",
                    round: mockRound.id,
                },
            },
        } as unknown as Application;

        beforeEach(() => {
            vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
                mockRound,
            );
            vi.spyOn(
                mockApplicationRepository,
                "getApplicationByAnchorAddressOrThrow",
            ).mockResolvedValue(mockApplication);
        });

        it("correctly converts pricing provider timestamp (ms) to donation timestamp", async () => {
            // Setup pricing provider to return a specific timestamp in milliseconds
            const priceTimestampMs = 1704067200000; // 2024-01-01 00:00:00.000Z in milliseconds
            vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
                timestampMs: priceTimestampMs,
                priceUsd: 1.0,
            });

            mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);

            handler = new DVMDAllocatedHandler(mockEvent, chainId, {
                roundRepository: mockRoundRepository,
                applicationRepository: mockApplicationRepository,
                pricingProvider: mockPricingProvider,
            });

            const result = await handler.handle();
            const donation = (result[0] as { type: "InsertDonation"; args: { donation: Donation } })
                .args.donation;

            // Verify the timestamp is correctly converted
            expect(donation.timestamp).toEqual(new Date("2024-01-01T00:00:00.000Z"));
            expect(donation.timestamp.getTime()).toBe(priceTimestampMs);
        });

        it("falls back to epoch start when timestamp conversion fails", async () => {
            // Setup pricing provider to return an invalid timestamp
            vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
                timestampMs: -1, // Invalid timestamp
                priceUsd: 1.0,
            });

            mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);

            handler = new DVMDAllocatedHandler(mockEvent, chainId, {
                roundRepository: mockRoundRepository,
                applicationRepository: mockApplicationRepository,
                pricingProvider: mockPricingProvider,
            });

            const result = await handler.handle();
            const donation = (result[0] as { type: "InsertDonation"; args: { donation: Donation } })
                .args.donation;

            // Verify it falls back to epoch start (1970-01-01T00:00:00.000Z)
            expect(donation.timestamp).toEqual(new Date(0));
        });
    });
});
