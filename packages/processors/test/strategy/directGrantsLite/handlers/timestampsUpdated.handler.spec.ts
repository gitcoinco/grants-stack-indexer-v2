import { beforeEach, describe, expect, it, vi } from "vitest";

import { IRoundRepository, Round, RoundNotFound } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { DGLiteTimestampsUpdatedHandler } from "../../../../src/processors/strategy/directGrantsLite/handlers/timestampsUpdated.handler.js";
import { createMockEvent } from "../../../mocks/index.js";

describe("DGLiteTimestampsUpdatedHandler", () => {
    let handler: DGLiteTimestampsUpdatedHandler;
    let mockRoundRepository: IRoundRepository;
    let mockEvent: ProcessorEvent<"Strategy", "TimestampsUpdated">;
    const chainId = 10 as ChainId;
    const eventName = "TimestampsUpdated";
    const defaultParams = {
        startTime: "1704067200", // 2024-01-01 00:00:00
        endTime: "1704153600", // 2024-01-02 00:00:00
        sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundRepository;
    });

    it("handles a valid timestamps update event", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockRound = { id: "round1" } as unknown as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );

        handler = new DGLiteTimestampsUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        const updateRound = result[0] as {
            type: "UpdateRound";
            args: {
                chainId: ChainId;
                roundId: string;
                round: {
                    applicationsStartTime: Date;
                    applicationsEndTime: Date;
                };
            };
        };

        expect(updateRound).toEqual({
            type: "UpdateRound",
            args: {
                chainId,
                roundId: "round1",
                round: {
                    applicationsStartTime: new Date("2024-01-01T00:00:00.000Z"),
                    applicationsEndTime: new Date("2024-01-02T00:00:00.000Z"),
                },
            },
        });
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new DGLiteTimestampsUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });
});
