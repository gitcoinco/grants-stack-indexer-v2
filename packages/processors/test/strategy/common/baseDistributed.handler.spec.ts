import { beforeEach, describe, expect, it, vi } from "vitest";

import { IRoundReadRepository, Round } from "@grants-stack-indexer/repository";
import { ChainId, ILogger, ProcessorEvent } from "@grants-stack-indexer/shared";

import { BaseDistributedHandler } from "../../../src/processors/strategy/common/baseDistributed.handler.js";

function createMockEvent(
    overrides: Partial<ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">> = {},
): ProcessorEvent<"Strategy", "DistributedWithRecipientAddress"> {
    const defaultEvent: ProcessorEvent<"Strategy", "DistributedWithRecipientAddress"> = {
        params: {
            amount: "1000",
            recipientAddress: "0x1234567890123456789012345678901234567890",
            recipientId: "0x1234567890123456789012345678901234567890",
            sender: "0x1234567890123456789012345678901234567890",
        },
        eventName: "DistributedWithRecipientAddress",
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

    return { ...defaultEvent, ...overrides };
}

describe("BaseDistributedHandler", () => {
    let handler: BaseDistributedHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockEvent: ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">;
    const chainId = 10 as ChainId;
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddress: vi.fn(),
        } as unknown as IRoundReadRepository;
    });

    it("increments round total distributed when round is found", async () => {
        mockEvent = createMockEvent();
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(mockRound);

        handler = new BaseDistributedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            logger,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "IncrementRoundTotalDistributed",
                args: {
                    chainId,
                    roundId: "round1",
                    amount: BigInt(mockEvent.params.amount),
                },
            },
        ]);
    });

    it("returns an empty array when round is not found", async () => {
        mockEvent = createMockEvent();

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(undefined);

        handler = new BaseDistributedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            logger,
        });

        const result = await handler.handle();

        expect(result).toEqual([]);
    });
});
