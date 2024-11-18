import { beforeEach, describe, expect, it, vi } from "vitest";

import { IRoundRepository, Round, RoundNotFound } from "@grants-stack-indexer/repository";
import { ChainId, DeepPartial, mergeDeep, ProcessorEvent } from "@grants-stack-indexer/shared";

import { DGSimpleTimestampsUpdatedHandler } from "../../../../src/processors/strategy/directGrantsSimple/handlers/timestampsUpdated.handler.js";

function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"Strategy", "TimestampsUpdated">> = {},
): ProcessorEvent<"Strategy", "TimestampsUpdated"> {
    const defaultEvent: ProcessorEvent<"Strategy", "TimestampsUpdated"> = {
        params: {
            startTime: "1704067200", // 2024-01-01 00:00:00
            endTime: "1704153600", // 2024-01-02 00:00:00
            sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        eventName: "TimestampsUpdated",
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

    return mergeDeep(defaultEvent, overrides);
}

describe("DGSimpleTimestampsUpdatedHandler", () => {
    let handler: DGSimpleTimestampsUpdatedHandler;
    let mockRoundRepository: IRoundRepository;
    let mockEvent: ProcessorEvent<"Strategy", "TimestampsUpdated">;
    const chainId = 10 as ChainId;

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundRepository;
    });

    it("handles a valid timestamps update event", async () => {
        mockEvent = createMockEvent();
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );

        handler = new DGSimpleTimestampsUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "UpdateRound",
                args: {
                    chainId,
                    roundId: "round1",
                    round: {
                        applicationsStartTime: new Date("2024-01-01T00:00:00.000Z"),
                        applicationsEndTime: new Date("2024-01-02T00:00:00.000Z"),
                    },
                },
            },
        ]);
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent();
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new DGSimpleTimestampsUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });
});
