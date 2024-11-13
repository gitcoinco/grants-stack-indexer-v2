import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    Application,
    ApplicationNotFound,
    IApplicationRepository,
    IRoundReadRepository,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import {
    ChainId,
    DeepPartial,
    Logger,
    mergeDeep,
    ProcessorEvent,
} from "@grants-stack-indexer/shared";

import "../../../src/exceptions/index.js";

import { BaseFundsDistributedHandler } from "../../../src/strategy/common/index.js";

function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"Strategy", "FundsDistributed">> = {},
): ProcessorEvent<"Strategy", "FundsDistributed"> {
    const defaultEvent: ProcessorEvent<"Strategy", "FundsDistributed"> = {
        params: {
            recipientId: "0x1234567890123456789012345678901234567890",
            amount: 1000000000000000000n,
            grantee: "0x1234567890123456789012345678901234567890",
            token: "0x0000000000000000000000000000000000000000",
        },
        eventName: "FundsDistributed",
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

describe("BaseFundsDistributedHandler", () => {
    let handler: BaseFundsDistributedHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockApplicationRepository: IApplicationRepository;
    let mockLogger: Logger;
    let mockEvent: ProcessorEvent<"Strategy", "FundsDistributed">;
    const chainId = 10 as ChainId;

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundReadRepository;
        mockApplicationRepository = {
            getApplicationByAnchorAddressOrThrow: vi.fn(),
        } as unknown as IApplicationRepository;
        mockLogger = {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        } as unknown as Logger;
    });

    it("handles a valid funds distributed event", async () => {
        mockEvent = createMockEvent();
        const mockRound = { id: "round1" } as unknown as Round;
        const mockApplication = { id: "app1" } as unknown as Application;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);

        handler = new BaseFundsDistributedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "UpdateApplication",
                args: {
                    chainId,
                    roundId: "round1",
                    applicationId: "app1",
                    application: {
                        distributionTransaction: mockEvent.transactionFields.hash,
                    },
                },
            },
            {
                type: "IncrementRoundTotalDistributed",
                args: {
                    chainId,
                    roundId: "round1",
                    amount: mockEvent.params.amount,
                },
            },
        ]);
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent();
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new BaseFundsDistributedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });

    it("throws ApplicationNotFound if application is not found", async () => {
        mockEvent = createMockEvent();
        const mockRound = { id: "round1" } as unknown as Round;

        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockRejectedValue(
            new ApplicationNotFound(chainId, mockRound.id, mockEvent.params.recipientId),
        );

        handler = new BaseFundsDistributedHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(ApplicationNotFound);
    });
});
