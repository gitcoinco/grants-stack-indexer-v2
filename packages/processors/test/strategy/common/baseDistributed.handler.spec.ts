import { beforeEach, describe, expect, it, vi } from "vitest";

import { IRoundReadRepository, Round } from "@grants-stack-indexer/repository";
import { ChainId, ILogger, ProcessorEvent } from "@grants-stack-indexer/shared";

import { BaseDistributedHandler } from "../../../src/processors/strategy/common/baseDistributed.handler.js";
import { createMockEvent } from "../../mocks/index.js";

describe("BaseDistributedHandler", () => {
    let handler: BaseDistributedHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockEvent: ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">;
    const chainId = 10 as ChainId;
    const eventName = "DistributedWithRecipientAddress";
    const defaultParams = {
        amount: "1000",
        recipientAddress: "0x1234567890123456789012345678901234567890",
        recipientId: "0x1234567890123456789012345678901234567890",
        sender: "0x1234567890123456789012345678901234567890",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

    const logger: ILogger = {
        debug: vi.fn(),
        verbose: vi.fn(),
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
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
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddress").mockResolvedValue(undefined);

        handler = new BaseDistributedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            logger,
        });

        const result = await handler.handle();

        expect(result).toEqual([]);
    });
});
