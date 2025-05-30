import { IRoundRepository, RoundChangeset } from "@grants-stack-indexer/repository";
import { performanceLogger } from "@grants-stack-indexer/shared";

import { ChangesetHandler } from "../types/index.js";

/**
 * Collection of handlers for round-related operations.
 * Each handler corresponds to a specific Round changeset type.
 */
export type RoundHandlers = {
    [K in RoundChangeset["type"]]: ChangesetHandler<K>;
};

/**
 * Creates handlers for managing round-related operations.
 *
 * @param repository - The round repository instance used for database operations
 * @returns An object containing all round-related handlers
 */
export const createRoundHandlers = (repository: IRoundRepository): RoundHandlers => ({
    InsertRound: (async (changeset, txConnection): Promise<void> => {
        const { round } = changeset.args;
        await repository.insertRound(round, txConnection);
    }) satisfies ChangesetHandler<"InsertRound">,

    UpdateRound: (async (changeset, txConnection): Promise<void> => {
        const { chainId, roundId, round } = changeset.args;
        await repository.updateRound({ id: roundId, chainId }, round, txConnection);
    }) satisfies ChangesetHandler<"UpdateRound">,

    UpdateRoundByStrategyAddress: (async (changeset, txConnection): Promise<void> => {
        const { chainId, strategyAddress, round } = changeset.args;
        if (round) {
            await repository.updateRound(
                { strategyAddress, chainId: chainId },
                round,
                txConnection,
            );
        }
    }) satisfies ChangesetHandler<"UpdateRoundByStrategyAddress">,

    IncrementRoundFundedAmount: (async (changeset, txConnection): Promise<void> => {
        const { chainId, roundId, fundedAmount, fundedAmountInUsd } = changeset.args;
        await repository.incrementRoundFunds(
            {
                chainId,
                roundId,
            },
            fundedAmount,
            fundedAmountInUsd,
            txConnection,
        );
    }) satisfies ChangesetHandler<"IncrementRoundFundedAmount">,

    IncrementRoundDonationStats: (async (changeset, txConnection): Promise<void> => {
        const startTime = performance.now();
        const { chainId, roundId, amountInUsd } = changeset.args;
        await repository.incrementRoundDonationStats(
            {
                chainId,
                roundId,
            },
            amountInUsd,
            txConnection,
        );
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Get current round stats for logging
        const round = await repository.getRoundById(chainId, roundId);

        performanceLogger.logMetric({
            timestamp: new Date().toISOString(),
            eventType: "Round",
            operation: "IncrementRoundDonationStats",
            duration,
            totalTime: duration,
            chainId,
            roundId,
            amountInUsd,
            uniqueDonorsCount: round?.uniqueDonorsCount,
            totalDonationsCount: round?.totalDonationsCount,
            details: {
                totalAmountDonatedInUsd: round?.totalAmountDonatedInUsd,
            },
        });
    }) satisfies ChangesetHandler<"IncrementRoundDonationStats">,

    IncrementRoundTotalDistributed: (async (changeset, txConnection): Promise<void> => {
        const { chainId, roundId, amount } = changeset.args;
        await repository.incrementRoundTotalDistributed(
            {
                chainId,
                roundId,
            },
            amount,
            txConnection,
        );
    }) satisfies ChangesetHandler<"IncrementRoundTotalDistributed">,

    InsertPendingRoundRole: (async (changeset, txConnection): Promise<void> => {
        const { pendingRoundRole } = changeset.args;
        await repository.insertPendingRoundRole(pendingRoundRole, txConnection);
    }) satisfies ChangesetHandler<"InsertPendingRoundRole">,

    DeletePendingRoundRoles: (async (changeset, txConnection): Promise<void> => {
        const { ids } = changeset.args;
        await repository.deleteManyPendingRoundRoles(ids, txConnection);
    }) satisfies ChangesetHandler<"DeletePendingRoundRoles">,

    InsertRoundRole: (async (changeset, txConnection): Promise<void> => {
        const { roundRole } = changeset.args;
        await repository.insertRoundRole(roundRole, txConnection);
    }) satisfies ChangesetHandler<"InsertRoundRole">,

    DeleteAllRoundRolesByRoleAndAddress: (async (changeset, txConnection): Promise<void> => {
        const { chainId, roundId, role, address } = changeset.args.roundRole;
        await repository.deleteManyRoundRolesByRoleAndAddress(
            chainId,
            roundId,
            role,
            address,
            txConnection,
        );
    }) satisfies ChangesetHandler<"DeleteAllRoundRolesByRoleAndAddress">,
});
