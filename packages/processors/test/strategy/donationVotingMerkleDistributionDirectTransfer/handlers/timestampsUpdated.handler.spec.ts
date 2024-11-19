import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    IRoundReadRepository,
    PartialRound,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { DVMDTimestampsUpdatedHandler } from "../../../../src/internal.js";
import { createMockEvent } from "../../../mocks/index.js";

describe("DVMDTimestampsUpdatedHandler", () => {
    let handler: DVMDTimestampsUpdatedHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockEvent: ProcessorEvent<"Strategy", "TimestampsUpdatedWithRegistrationAndAllocation">;
    const chainId = 10 as ChainId;
    const eventName = "TimestampsUpdatedWithRegistrationAndAllocation";
    const defaultParams = {
        registrationStartTime: "1000000000",
        registrationEndTime: "1000086400", // +1 day
        allocationStartTime: "1000172800", // +2 days
        allocationEndTime: "1000259200", // +3 days
        sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundReadRepository;
    });

    it("handle a valid timestamps update event", async () => {
        const timestamps = {
            registrationStartTime: "1704067200", // 2024-01-01 00:00:00
            registrationEndTime: "1704153600", // 2024-01-02 00:00:00
            allocationStartTime: "1704240000", // 2024-01-03 00:00:00
            allocationEndTime: "1704326400", // 2024-01-04 00:00:00
        };

        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: timestamps,
        });
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );

        handler = new DVMDTimestampsUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        expect(result.length).toBe(1);
        const changeset = result[0] as {
            type: "UpdateRound";
            args: { chainId: ChainId; roundId: string; round: PartialRound };
        };

        expect(changeset.type).toBe("UpdateRound");
        expect(changeset.args.chainId).toBe(chainId);
        expect(changeset.args.roundId).toBe("round1");
        expect(changeset.args.round).toBeDefined();

        const partialRound = changeset.args.round;

        expect(partialRound.applicationsStartTime).toEqual(new Date("2024-01-01T00:00:00.000Z"));
        expect(partialRound.applicationsEndTime).toEqual(new Date("2024-01-02T00:00:00.000Z"));
        expect(partialRound.donationsStartTime).toEqual(new Date("2024-01-03T00:00:00.000Z"));
        expect(partialRound.donationsEndTime).toEqual(new Date("2024-01-04T00:00:00.000Z"));
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new DVMDTimestampsUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });

    it("correctly convert timestamps to Date objects", async () => {
        const timestamps = {
            registrationStartTime: "1704067200", // 2024-01-01 00:00:00
            registrationEndTime: "1704153600", // 2024-01-02 00:00:00
            allocationStartTime: "1704240000", // 2024-01-03 00:00:00
            allocationEndTime: "1704326400", // 2024-01-04 00:00:00
        };

        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: timestamps,
        });
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );

        handler = new DVMDTimestampsUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        expect(result.length).toBe(1);
        const changeset = result[0] as {
            type: "UpdateRound";
            args: { chainId: ChainId; roundId: string; round: PartialRound };
        };

        expect(changeset.type).toBe("UpdateRound");
        expect(changeset.args.chainId).toBe(chainId);
        expect(changeset.args.roundId).toBe("round1");
        expect(changeset.args.round).toBeDefined();

        const partialRound = changeset.args.round;

        expect(partialRound.applicationsStartTime).toEqual(new Date("2024-01-01T00:00:00.000Z"));
        expect(partialRound.applicationsEndTime).toEqual(new Date("2024-01-02T00:00:00.000Z"));
        expect(partialRound.donationsStartTime).toEqual(new Date("2024-01-03T00:00:00.000Z"));
        expect(partialRound.donationsEndTime).toEqual(new Date("2024-01-04T00:00:00.000Z"));
    });
});
