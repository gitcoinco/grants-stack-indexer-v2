import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    Application,
    IApplicationRepository,
    IRoundReadRepository,
    PartialApplication,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import { ChainId, Logger, ProcessorEvent } from "@grants-stack-indexer/shared";

import { BaseRecipientStatusUpdatedHandler } from "../../../src/internal.js";
import { createMockEvent } from "../../mocks/index.js";

describe("BaseRecipientStatusUpdatedHandler", () => {
    let handler: BaseRecipientStatusUpdatedHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockApplicationRepository: IApplicationRepository;
    let mockLogger: Logger;
    let mockEvent: ProcessorEvent<"Strategy", "RecipientStatusUpdatedWithFullRow">;
    const chainId = 10 as ChainId;
    const eventName = "RecipientStatusUpdatedWithFullRow";
    const defaultParams = {
        rowIndex: "0",
        fullRow: "801", // 001100100001 (status 1 at index 0, status 2 at index 4, status 3 at index 8)
        sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundReadRepository;
        mockApplicationRepository = {
            getApplicationById: vi.fn(),
        } as unknown as IApplicationRepository;
        mockLogger = {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        } as unknown as Logger;
    });

    it("handles valid status updates for multiple applications", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            blockNumber: 12345,
        });
        const mockRound = { id: "round1" } as Round;
        const mockApplication1 = {
            id: "0",
            status: "PENDING",
            statusSnapshots: [],
            statusUpdatedAtBlock: 12344n,
        } as unknown as Application;
        const mockApplication2 = {
            id: "4",
            status: "PENDING",
            statusSnapshots: [],
            statusUpdatedAtBlock: 12344n,
        } as unknown as Application;
        const mockApplication3 = {
            id: "8",
            status: "PENDING",
            statusSnapshots: [],
            statusUpdatedAtBlock: 12344n,
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockApplicationRepository, "getApplicationById")
            .mockResolvedValueOnce(mockApplication1)
            .mockResolvedValueOnce(mockApplication2)
            .mockResolvedValueOnce(mockApplication3);

        handler = new BaseRecipientStatusUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        const result = await handler.handle();

        expect(result).toHaveLength(3);
        const changeset0 = result[0] as {
            type: "UpdateApplication";
            args: { application: PartialApplication };
        };
        expect(changeset0).toEqual({
            type: "UpdateApplication",
            args: {
                chainId,
                roundId: "round1",
                applicationId: "0",
                application: {
                    status: "PENDING",
                    statusUpdatedAtBlock: 12345n,
                    statusSnapshots: [],
                },
            },
        });

        const changeset1 = result[1] as {
            type: "UpdateApplication";
            args: { application: PartialApplication };
        };
        expect(changeset1).toEqual({
            type: "UpdateApplication",
            args: {
                chainId,
                roundId: "round1",
                applicationId: "4",
                application: {
                    status: "APPROVED",
                    statusUpdatedAtBlock: 12345n,
                    statusSnapshots: [
                        {
                            status: "APPROVED",
                            updatedAtBlock: "12345",
                            updatedAt: new Date(mockEvent.blockTimestamp),
                        },
                    ],
                },
            },
        });

        const changeset2 = result[2] as {
            type: "UpdateApplication";
            args: { application: PartialApplication };
        };
        expect(changeset2).toEqual({
            type: "UpdateApplication",
            args: {
                chainId,
                roundId: "round1",
                applicationId: "8",
                application: {
                    status: "REJECTED",
                    statusUpdatedAtBlock: 12345n,
                    statusSnapshots: [
                        {
                            status: "REJECTED",
                            updatedAtBlock: "12345",
                            updatedAt: new Date(mockEvent.blockTimestamp),
                        },
                    ],
                },
            },
        });
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new BaseRecipientStatusUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });

    it("skips applications that are not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockApplicationRepository, "getApplicationById").mockResolvedValue(undefined);

        handler = new BaseRecipientStatusUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        const result = await handler.handle();
        expect(result).toHaveLength(0);
    });

    it("skips invalid status values", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: {
                rowIndex: "0",
                fullRow: "96", // Binary: 1100000 (invalid statuses 6 and 7)
            },
        });
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );

        handler = new BaseRecipientStatusUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        const result = await handler.handle();
        expect(result).toHaveLength(0);
    });

    it("doesn't create new status snapshot if status hasn't changed", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: { rowIndex: "0", fullRow: "2" }, // Binary: 10 (status 2 at index 0)
        });
        const mockRound = { id: "round1" } as Round;
        const mockApplication = {
            id: "0",
            status: "APPROVED", // Same as the new status
            statusSnapshots: [
                {
                    status: "APPROVED",
                    updatedAtBlock: "12344",
                    updatedAt: new Date(1000000000),
                },
            ],
            statusUpdatedAtBlock: 12344n,
        } as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockApplicationRepository, "getApplicationById").mockResolvedValue(
            mockApplication,
        );

        handler = new BaseRecipientStatusUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        const result = await handler.handle();
        expect(result).toBeDefined();
        expect(result.length).toBe(1);

        const changeset = result[0] as {
            type: "UpdateApplication";
            args: { application: PartialApplication };
        };
        expect(changeset.args.application.statusSnapshots).toHaveLength(1);
        expect(changeset.args.application.statusSnapshots).toEqual(mockApplication.statusSnapshots);
    });

    it("handles different row indexes correctly", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: {
                rowIndex: "1", // Second row
                fullRow: "33", // 00100001 (status 1 at index 0, status 1 at index 4)
            },
        });
        const mockRound = { id: "round1" } as Round;
        const mockApplication = {
            id: "64", // Index 0 in second row (64 = 1 * 64 + 0)
            status: "PENDING",
            statusSnapshots: [],
            statusUpdatedAtBlock: 12344n,
        } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(mockApplicationRepository, "getApplicationById").mockResolvedValue(
            mockApplication,
        );

        handler = new BaseRecipientStatusUpdatedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        const result = await handler.handle();
        expect(result).toHaveLength(2);
        expect(mockApplicationRepository.getApplicationById).toHaveBeenCalledWith(
            "64",
            chainId,
            "round1",
        );
        const changeset1 = result[1] as {
            type: "UpdateApplication";
            args: { application: PartialApplication };
        };
        expect(changeset1.args.application.status).toBe("APPROVED");
    });
});
