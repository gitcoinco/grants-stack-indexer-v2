import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChainId, ILogger, ProcessorEvent, Token } from "@grants-stack-indexer/shared";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import { IRoundReadRepository, Round } from "@grants-stack-indexer/repository";
import { TOKENS, UnknownToken } from "@grants-stack-indexer/shared";

import { calculateAmountInUsd } from "../../../src/helpers/index.js";
import { PoolFundedHandler } from "../../../src/processors/allo/handlers/index.js";

function createMockEvent(
    overrides: Partial<ProcessorEvent<"Allo", "PoolFunded">> = {},
): ProcessorEvent<"Allo", "PoolFunded"> {
    return {
        blockNumber: 116385567,
        blockTimestamp: 1708369911,
        chainId: 10 as ChainId,
        contractName: "Allo",
        eventName: "PoolFunded",
        logIndex: 123,
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        params: {
            poolId: 1n,
            amount: 100n,
            fee: 10n,
        },
        transactionFields: {
            hash: "0xtransactionhash",
            transactionIndex: 5,
            from: "0xsenderaddress",
        },
        ...overrides,
    };
}

describe("PoolFundedHandler", () => {
    let mockPricingProvider: IPricingProvider;
    let mockRoundRepository: IRoundReadRepository;
    let mockLogger: ILogger;
    let handler: PoolFundedHandler;

    const mockDependencies = (): {
        roundRepository: IRoundReadRepository;
        pricingProvider: IPricingProvider;
        logger: ILogger;
    } => ({
        roundRepository: mockRoundRepository,
        pricingProvider: mockPricingProvider,
        logger: mockLogger,
    });

    beforeEach(() => {
        mockRoundRepository = {
            getRoundById: vi.fn(),
        } as unknown as IRoundReadRepository;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
        };
        mockLogger = {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
        } as unknown as ILogger;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns a changeset with funded amount and USD value", async () => {
        const mockEvent = createMockEvent();
        const mockToken = Object.values(
            TOKENS["10"] as {
                [tokenAddress: `0x${string}`]: Token;
            },
        )[0];
        const mockPrice = {
            priceUsd: 2.5,
            timestampMs: 1708369911,
        };
        const round = {
            id: "1",
            matchTokenAddress: mockToken?.address,
        };
        vi.spyOn(mockRoundRepository, "getRoundById").mockResolvedValue(round as Round);
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue(mockPrice);

        handler = new PoolFundedHandler(
            mockEvent,
            mockEvent.chainId as ChainId,
            mockDependencies(),
        );

        const result = await handler.handle();

        expect(mockRoundRepository.getRoundById).toHaveBeenCalledWith(10, "1");
        expect(mockPricingProvider.getTokenPrice).toHaveBeenCalled();
        expect(result).toEqual([
            {
                type: "IncrementRoundFundedAmount",
                args: {
                    chainId: 10,
                    roundId: "1",
                    fundedAmount: mockEvent.params.amount,
                    fundedAmountInUsd: calculateAmountInUsd(
                        mockEvent.params.amount,
                        mockPrice.priceUsd,
                        mockToken?.decimals as number,
                    ),
                },
            },
        ]);
    });

    it("returns an empty changeset if the round does not exist", async () => {
        const mockEvent = createMockEvent();
        vi.spyOn(mockRoundRepository, "getRoundById").mockResolvedValue(undefined);

        handler = new PoolFundedHandler(
            mockEvent,
            mockEvent.chainId as ChainId,
            mockDependencies(),
        );

        const result = await handler.handle();

        expect(mockRoundRepository.getRoundById).toHaveBeenCalledWith(mockEvent.chainId, "1");
        expect(result).toEqual([]);
    });

    it("throws an error for an unknown token", async () => {
        const mockEvent = createMockEvent();
        const mockRound = {
            id: "1",
            matchTokenAddress: "0xUnknownToken",
        };
        vi.spyOn(mockRoundRepository, "getRoundById").mockResolvedValue(mockRound as Round);

        handler = new PoolFundedHandler(
            mockEvent,
            mockEvent.chainId as ChainId,
            mockDependencies(),
        );

        await expect(handler.handle()).rejects.toThrow(UnknownToken);
    });
});
