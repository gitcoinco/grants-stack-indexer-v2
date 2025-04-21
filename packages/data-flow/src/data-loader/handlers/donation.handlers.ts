import { DonationChangeset, IDonationRepository } from "@grants-stack-indexer/repository";
import { performanceLogger } from "@grants-stack-indexer/shared";

import { ChangesetHandler } from "../types/index.js";

/**
 * Collection of handlers for application-related operations.
 * Each handler corresponds to a specific Application changeset type.
 */
export type DonationHandlers = {
    [K in DonationChangeset["type"]]: ChangesetHandler<K>;
};

/**
 * Creates handlers for managing application-related operations.
 *
 * @param repository - The application repository instance used for database operations
 * @returns An object containing all application-related handlers
 */
export const createDonationHandlers = (repository: IDonationRepository): DonationHandlers => ({
    InsertDonation: (async (changeset, txConnection): Promise<void> => {
        const startTime = performance.now();
        await repository.insertDonation(changeset.args.donation, txConnection);
        const endTime = performance.now();
        const duration = endTime - startTime;

        performanceLogger.logMetric({
            timestamp: new Date().toISOString(),
            eventType: "Donation",
            operation: "InsertDonation",
            duration,
            totalTime: duration,
            blockNumber: Number(changeset.args.donation.blockNumber),
            transactionHash: changeset.args.donation.transactionHash,
            chainId: changeset.args.donation.chainId,
            roundId: changeset.args.donation.roundId,
            applicationId: changeset.args.donation.applicationId || undefined,
            donorAddress: changeset.args.donation.donorAddress,
            recipientAddress: changeset.args.donation.recipientAddress,
            amount: changeset.args.donation.amount.toString(),
            amountInUsd: changeset.args.donation.amountInUsd,
            details: {
                tokenAddress: changeset.args.donation.tokenAddress,
                amountInRoundMatchToken: changeset.args.donation.amountInRoundMatchToken.toString(),
            },
        });
    }) satisfies ChangesetHandler<"InsertDonation">,

    InsertManyDonations: (async (changeset, txConnection): Promise<void> => {
        const startTime = performance.now();
        await repository.insertManyDonations(changeset.args.donations, txConnection);
        const endTime = performance.now();
        const duration = endTime - startTime;

        const firstDonation = changeset.args.donations[0];
        performanceLogger.logMetric({
            timestamp: new Date().toISOString(),
            eventType: "Donation",
            operation: "InsertManyDonations",
            duration,
            totalTime: duration,
            blockNumber: firstDonation ? Number(firstDonation.blockNumber) : undefined,
            transactionHash: firstDonation?.transactionHash,
            chainId: firstDonation?.chainId,
            roundId: firstDonation?.roundId,
            amount: firstDonation ? firstDonation.amount.toString() : undefined,
            amountInUsd: firstDonation?.amountInUsd,
            details: {
                count: changeset.args.donations.length,
                totalAmountInUsd: changeset.args.donations
                    .reduce((sum, d) => sum + Number(d.amountInUsd), 0)
                    .toString(),
            },
        });
    }) satisfies ChangesetHandler<"InsertManyDonations">,
});
