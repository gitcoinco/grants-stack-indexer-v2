import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    IRoundRepository,
    NewRound,
    TransactionConnection,
} from "@grants-stack-indexer/repository";
import { Address, ChainId } from "@grants-stack-indexer/shared";

import { createRoundHandlers } from "../../../src/data-loader/handlers/round.handlers.js";

describe("Round Handlers", () => {
    const mockRepository = {
        insertRound: vi.fn(),
        updateRound: vi.fn(),
        incrementRoundFunds: vi.fn(),
        incrementRoundTotalDistributed: vi.fn(),
        insertPendingRoundRole: vi.fn(),
        deleteManyPendingRoundRoles: vi.fn(),
        insertRoundRole: vi.fn(),
        deleteManyRoundRolesByRoleAndAddress: vi.fn(),
    } as unknown as IRoundRepository;
    const mockTxConnection = { query: vi.fn() } as unknown as TransactionConnection;

    const handlers = createRoundHandlers(mockRepository);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handle InsertRound changeset", async () => {
        const round = {
            id: "round-1",
            chainId: 1 as ChainId,
            matchAmount: 1000n,
        } as NewRound;

        await handlers.InsertRound(
            {
                type: "InsertRound" as const,
                args: { round },
            },
            mockTxConnection,
        );

        expect(mockRepository.insertRound).toHaveBeenCalledWith(round, mockTxConnection);
    });

    it("handle UpdateRound changeset", async () => {
        const update = {
            type: "UpdateRound",
            args: {
                chainId: 1 as ChainId,
                roundId: "round-1",
                round: {
                    matchAmount: 2000n,
                    matchAmountInUsd: "2000",
                },
            },
        } as const;

        await handlers.UpdateRound(update);

        expect(mockRepository.updateRound).toHaveBeenCalledWith(
            { id: "round-1", chainId: 1 as ChainId },
            { matchAmount: 2000n, matchAmountInUsd: "2000" },
            undefined,
        );
    });

    it("handle UpdateRoundByStrategyAddress changeset", async () => {
        const update = {
            type: "UpdateRoundByStrategyAddress",
            args: {
                chainId: 1 as ChainId,
                strategyAddress: "0x123" as Address,
                round: {
                    matchAmount: 2000n,
                    matchAmountInUsd: "2000",
                },
            },
        } as const;

        await handlers.UpdateRoundByStrategyAddress(update);

        expect(mockRepository.updateRound).toHaveBeenCalledWith(
            { chainId: 1 as ChainId, strategyAddress: "0x123" as Address },
            { matchAmount: 2000n, matchAmountInUsd: "2000" },
            undefined,
        );
    });

    it("handle IncrementRoundFundedAmount changeset", async () => {
        const changeset = {
            type: "IncrementRoundFundedAmount",
            args: {
                chainId: 1 as ChainId,
                roundId: "round-1",
                fundedAmount: 1000n,
                fundedAmountInUsd: "1000",
            },
        } as const;

        await handlers.IncrementRoundFundedAmount(changeset);

        expect(mockRepository.incrementRoundFunds).toHaveBeenCalledWith(
            { chainId: 1 as ChainId, roundId: "round-1" },
            1000n,
            "1000",
            undefined,
        );
    });

    it("handle IncrementRoundTotalDistributed changeset", async () => {
        const changeset = {
            type: "IncrementRoundTotalDistributed",
            args: {
                chainId: 1 as ChainId,
                roundId: "round-1",
                amount: 1000n,
            },
        } as const;

        await handlers.IncrementRoundTotalDistributed(changeset);

        expect(mockRepository.incrementRoundTotalDistributed).toHaveBeenCalledWith(
            { chainId: 1 as ChainId, roundId: "round-1" },
            1000n,
            undefined,
        );
    });

    it("handle InsertPendingRoundRole changeset", async () => {
        const changeset = {
            type: "InsertPendingRoundRole",
            args: {
                pendingRoundRole: {
                    chainId: 1 as ChainId,
                    role: "admin",
                    address: "0x123" as Address,
                    createdAtBlock: 100n,
                },
            },
        } as const;

        await handlers.InsertPendingRoundRole(changeset);

        expect(mockRepository.insertPendingRoundRole).toHaveBeenCalledWith(
            changeset.args.pendingRoundRole,
            undefined,
        );
    });

    it("handle DeletePendingRoundRoles changeset", async () => {
        const changeset = {
            type: "DeletePendingRoundRoles" as const,
            args: {
                ids: [1, 2, 3],
            },
        };

        await handlers.DeletePendingRoundRoles(changeset);

        expect(mockRepository.deleteManyPendingRoundRoles).toHaveBeenCalledWith(
            [1, 2, 3],
            undefined,
        );
    });

    it("handle InsertRoundRole changeset", async () => {
        const changeset = {
            type: "InsertRoundRole",
            args: {
                roundRole: {
                    chainId: 1 as ChainId,
                    roundId: "round-1",
                    address: "0x123" as Address,
                    role: "admin",
                    createdAtBlock: 100n,
                },
            },
        } as const;

        await handlers.InsertRoundRole(changeset);

        expect(mockRepository.insertRoundRole).toHaveBeenCalledWith(
            changeset.args.roundRole,
            undefined,
        );
    });

    it("handle DeleteAllRoundRolesByRoleAndAddress changeset", async () => {
        const changeset = {
            type: "DeleteAllRoundRolesByRoleAndAddress",
            args: {
                roundRole: {
                    chainId: 1 as ChainId,
                    roundId: "round-1",
                    role: "admin",
                    address: "0x123" as Address,
                },
            },
        } as const;

        await handlers.DeleteAllRoundRolesByRoleAndAddress(changeset);

        expect(mockRepository.deleteManyRoundRolesByRoleAndAddress).toHaveBeenCalledWith(
            changeset.args.roundRole.chainId,
            changeset.args.roundRole.roundId,
            changeset.args.roundRole.role,
            changeset.args.roundRole.address,
            undefined,
        );
    });
});
