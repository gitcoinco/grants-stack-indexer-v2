import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
    Bytes32String,
    ChainId,
    ILogger,
    ProcessorEvent,
    TimestampMs,
} from "@grants-stack-indexer/shared";

import { ProfileMigratedHandler } from "../../../../src/processors/alloV1ToV2ProfileMigration/index.js";

function createMockEvent(
    overrides: Partial<ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated">> = {},
): ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated"> {
    return {
        blockNumber: 116385567,
        blockTimestamp: 1708369911 as TimestampMs,
        chainId: 10 as ChainId,
        contractName: "AlloV1ToV2ProfileMigration",
        eventName: "ProfileMigrated",
        logIndex: 123,
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        params: {
            alloV1ChainId: "10",
            alloV1: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1" as Bytes32String,
            alloV2: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1" as Bytes32String,
            nonce: "1",
        },
        transactionFields: {
            hash: "0x6e5a7115323ac1712f7c27adff46df2216324a4ad615a8c9ce488c32a1f3a035",
            transactionIndex: 6,
            from: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5Address",
        },
        ...overrides,
    };
}

describe("ProfileMigratedHandler", () => {
    let mockLogger: ILogger;
    let handler: ProfileMigratedHandler;

    const mockDependencies = (): { logger: ILogger } => ({
        logger: mockLogger,
    });

    beforeEach(() => {
        mockLogger = {
            warn: vi.fn(),
        } as unknown as ILogger;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns a changeset to insert a legacy project", async () => {
        const mockEvent = createMockEvent();

        handler = new ProfileMigratedHandler(mockEvent, 10 as ChainId, mockDependencies());

        const result = await handler.handle();
        expect(result).toEqual([
            {
                type: "InsertLegacyProject",
                args: {
                    legacyProject: {
                        v1ChainId: Number(mockEvent.params.alloV1ChainId) as ChainId,
                        v1ProjectId: mockEvent.params.alloV1,
                        v2ProjectId: mockEvent.params.alloV2,
                    },
                },
            },
        ]);
    });
});
