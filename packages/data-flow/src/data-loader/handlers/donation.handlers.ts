import { DonationChangeset, IDonationRepository } from "@grants-stack-indexer/repository";

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
        await repository.insertDonation(changeset.args.donation, txConnection);
    }) satisfies ChangesetHandler<"InsertDonation">,

    InsertManyDonations: (async (changeset, txConnection): Promise<void> => {
        await repository.insertManyDonations(changeset.args.donations, txConnection);
    }) satisfies ChangesetHandler<"InsertManyDonations">,
});
