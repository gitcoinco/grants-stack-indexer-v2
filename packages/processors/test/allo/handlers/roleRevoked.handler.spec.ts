import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Bytes32String, ChainId, ILogger, ProcessorEvent } from "@grants-stack-indexer/shared";
import { IRoundReadRepository, Round } from "@grants-stack-indexer/repository";

import { RoleRevokedHandler } from "../../../src/processors/allo/handlers/roleRevoked.handler.js";

function createMockEvent(
    overrides: Partial<ProcessorEvent<"Allo", "RoleRevoked">> = {},
): ProcessorEvent<"Allo", "RoleRevoked"> {
    return {
        blockNumber: 116385567,
        blockTimestamp: 1708369911,
        chainId: 10 as ChainId,
        contractName: "Allo",
        eventName: "RoleRevoked",
        logIndex: 123,
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        params: {
            role: "admin" as Bytes32String,
            account: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
            sender: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5Address",
        },
        transactionFields: {
            hash: "0x6e5a7115323ac1712f7c27adff46df2216324a4ad615a8c9ce488c32a1f3a035",
            transactionIndex: 6,
            from: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5Address",
        },
        ...overrides,
    };
}

describe("RoleRevokedHandler", () => {
    let mockRoundRepository: IRoundReadRepository;
    let mockLogger: ILogger;
    let handler: RoleRevokedHandler;

    const mockDependencies = (): { roundRepository: IRoundReadRepository; logger: ILogger } => ({
        roundRepository: mockRoundRepository,
        logger: mockLogger,
    });

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByRole: vi.fn(),
        } as unknown as IRoundReadRepository;

        mockLogger = {
            warn: vi.fn(),
        } as unknown as ILogger;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns a changeset for an admin role in an existing round", async () => {
        const mockEvent = createMockEvent();
        const round = { id: "1" };

        vi.spyOn(mockRoundRepository, "getRoundByRole")
            .mockResolvedValueOnce(round as Round)
            .mockResolvedValueOnce(undefined);

        handler = new RoleRevokedHandler(mockEvent, 10 as ChainId, mockDependencies());

        const result = await handler.handle();

        expect(mockRoundRepository.getRoundByRole).toHaveBeenCalledWith(10, "admin", "admin");
        expect(result).toEqual([
            {
                type: "DeleteAllRoundRolesByRoleAndAddress",
                args: {
                    roundRole: {
                        chainId: 10,
                        roundId: "1",
                        role: "admin",
                        address: getAddress("0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5"),
                    },
                },
            },
        ]);
    });

    it("returns a changeset for a manager role in an existing round", async () => {
        const mockEvent = createMockEvent({
            params: {
                role: "manager" as Bytes32String,
                account: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
                sender: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
            },
        });
        const round = { id: "2" };

        vi.spyOn(mockRoundRepository, "getRoundByRole")
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(round as Round);

        handler = new RoleRevokedHandler(mockEvent, 10 as ChainId, mockDependencies());

        const result = await handler.handle();

        expect(mockRoundRepository.getRoundByRole).toHaveBeenCalledWith(
            10,
            "manager",
            mockEvent.params.role,
        );
        expect(result).toEqual([
            {
                type: "DeleteAllRoundRolesByRoleAndAddress",
                args: {
                    roundRole: {
                        chainId: 10,
                        roundId: "2",
                        role: "manager",
                        address: getAddress("0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5"),
                    },
                },
            },
        ]);
    });

    it("returns an empty array if no matching round is found", async () => {
        const mockEvent = createMockEvent({
            params: {
                role: "otherRole" as Bytes32String,
                account: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
                sender: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
            },
        });

        vi.spyOn(mockRoundRepository, "getRoundByRole")
            .mockResolvedValue(undefined)
            .mockResolvedValue(undefined);

        handler = new RoleRevokedHandler(mockEvent, 10 as ChainId, mockDependencies());

        const result = await handler.handle();

        expect(mockRoundRepository.getRoundByRole).toHaveBeenCalledWith(10, "admin", "otherrole");
        expect(mockRoundRepository.getRoundByRole).toHaveBeenCalledWith(10, "manager", "otherrole");
        expect(result).toEqual([]);
    });

    it("logs a warning if no round is found", async () => {
        const mockEvent = createMockEvent();
        vi.spyOn(mockRoundRepository, "getRoundByRole").mockResolvedValue(undefined);

        const logger = { warn: vi.fn() } as unknown as ILogger;
        handler = new RoleRevokedHandler(mockEvent, 10 as ChainId, {
            roundRepository: mockRoundRepository,
            logger,
        });

        await handler.handle();

        expect(logger.warn).toHaveBeenCalledWith(`No round found for role admin on chain 10`);
    });
});
