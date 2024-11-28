import { parseUnits } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IRoundReadRepository, Round } from "@grants-stack-indexer/repository";
import type { ChainId, ILogger, ProcessorEvent, Token } from "@grants-stack-indexer/shared";
import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import { TOKENS } from "@grants-stack-indexer/shared";

import { calculateAmountInUsd } from "../../../src/helpers/index.js";
import { TokenPriceNotFoundError } from "../../../src/internal.js";
import { PoolMetadataUpdatedHandler } from "../../../src/processors/allo/handlers/index.js";

function createMockEvent(
    overrides: Partial<ProcessorEvent<"Allo", "PoolMetadataUpdated">> = {},
): ProcessorEvent<"Allo", "PoolMetadataUpdated"> {
    return {
        blockNumber: 116385567,
        blockTimestamp: 1708369911,
        chainId: 10 as ChainId,
        contractName: "Allo",
        eventName: "PoolMetadataUpdated",
        logIndex: 456,
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        params: {
            poolId: "1",
            metadata: ["1", "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku"],
        },
        transactionFields: {
            hash: "0xtransactionhash",
            transactionIndex: 7,
            from: "0xsenderaddress",
        },
        ...overrides,
    };
}

describe("PoolMetadataUpdatedHandler", () => {
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;
    let mockLogger: ILogger;
    let mockPricingProvider: IPricingProvider;
    let handler: PoolMetadataUpdatedHandler;

    const mockDependencies = (): {
        metadataProvider: IMetadataProvider;
        roundRepository: IRoundReadRepository;
        logger: ILogger;
        pricingProvider: IPricingProvider;
    } => ({
        metadataProvider: mockMetadataProvider,
        roundRepository: mockRoundRepository,
        logger: mockLogger,
        pricingProvider: mockPricingProvider,
    });

    beforeEach(() => {
        mockMetadataProvider = {
            getMetadata: vi.fn(),
        };
        mockRoundRepository = {
            getRoundById: vi.fn(),
        } as unknown as IRoundReadRepository;
        mockLogger = {
            error: vi.fn(),
            info: vi.fn(),
        } as unknown as ILogger;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns a changeset with updated round metadata", async () => {
        const mockEvent = createMockEvent();
        const metadata = {
            round: {
                name: "asd",
                roundType: "public",
                quadraticFundingConfig: {
                    matchingFundsAvailable: 100,
                },
            },
            application: {},
        };
        const mockToken = Object.values(
            TOKENS["10"] as {
                [tokenAddress: `0x${string}`]: Token;
            },
        )[0];
        const round = {
            id: "1",
            matchTokenAddress: mockToken?.address,
            matchAmount: 0n,
            matchAmountInUsd: "0",
        };
        const mockTokenPrice = {
            priceUsd: 2.5,
            timestampMs: 1708369911,
        };
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(metadata);
        vi.spyOn(mockRoundRepository, "getRoundById").mockResolvedValue(round as Round);
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue(mockTokenPrice);

        handler = new PoolMetadataUpdatedHandler(
            mockEvent,
            mockEvent.chainId as ChainId,
            mockDependencies(),
        );

        const result = await handler.handle();
        const matchAmountResult = parseUnits(
            metadata.round.quadraticFundingConfig.matchingFundsAvailable.toString(),
            mockToken?.decimals as number,
        );
        expect(mockMetadataProvider.getMetadata).toHaveBeenCalledWith(
            "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
        );
        expect(mockRoundRepository.getRoundById).toHaveBeenCalledWith(10, "1");
        expect(result).toEqual([
            {
                type: "UpdateRound",
                args: {
                    chainId: 10,
                    roundId: "1",
                    round: {
                        matchAmount: matchAmountResult,
                        matchAmountInUsd: calculateAmountInUsd(
                            matchAmountResult,
                            mockTokenPrice.priceUsd,
                            mockToken?.decimals as number,
                        ),
                        applicationMetadataCid:
                            "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
                        applicationMetadata: metadata.application,
                        roundMetadataCid:
                            "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
                        roundMetadata: metadata.round,
                    },
                },
            },
        ]);
    });

    it("returns an empty changeset if the round does not exist", async () => {
        const mockEvent = createMockEvent();
        vi.spyOn(mockRoundRepository, "getRoundById").mockResolvedValue(undefined);

        handler = new PoolMetadataUpdatedHandler(mockEvent, 10 as ChainId, mockDependencies());

        const result = await handler.handle();

        expect(mockRoundRepository.getRoundById).toHaveBeenCalledWith(10, "1");
        expect(result).toEqual([]);
        expect(mockLogger.error).toHaveBeenCalledWith("Round not found for roundId: 1");
    });

    it("throws if tokenPrice is not found", async () => {
        const mockEvent = createMockEvent();
        const mockToken = Object.values(
            TOKENS["10"] as {
                [tokenAddress: `0x${string}`]: Token;
            },
        )[0];
        const metadata = {
            round: {
                name: "asd",
                roundType: "public",
                quadraticFundingConfig: {
                    matchingFundsAvailable: 100,
                },
            },
        };
        const round = {
            id: "1",
            matchTokenAddress: mockToken?.address,
            matchAmount: 0n,
            matchAmountInUsd: "0",
        };

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(metadata);
        vi.spyOn(mockRoundRepository, "getRoundById").mockResolvedValue(round as Round);
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue(undefined);

        handler = new PoolMetadataUpdatedHandler(mockEvent, 10 as ChainId, mockDependencies());

        await expect(handler.handle()).rejects.toThrowError(TokenPriceNotFoundError);
        expect(mockPricingProvider.getTokenPrice).toHaveBeenCalled();
    });

    it("returns a changeset with empty metadata if metadata parsing fails", async () => {
        const mockEvent = createMockEvent();
        const metadata = { round: null };
        const round = {
            id: "1",
            matchTokenAddress: "0xTokenAddress",
            matchAmount: 0n,
            matchAmountInUsd: "0",
        };

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(metadata);
        vi.spyOn(mockRoundRepository, "getRoundById").mockResolvedValue(round as Round);

        handler = new PoolMetadataUpdatedHandler(mockEvent, 10 as ChainId, mockDependencies());

        const result = await handler.handle();

        expect(mockMetadataProvider.getMetadata).toHaveBeenCalled();
        expect(result).toEqual([
            {
                type: "UpdateRound",
                args: {
                    chainId: 10,
                    roundId: "1",
                    round: {
                        matchAmount: 0n,
                        matchAmountInUsd: "0",
                        applicationMetadataCid:
                            "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
                        applicationMetadata: {},
                        roundMetadataCid:
                            "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
                        roundMetadata: {},
                    },
                },
            },
        ]);
    });
});
