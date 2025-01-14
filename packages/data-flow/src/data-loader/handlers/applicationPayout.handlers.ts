import {
    ApplicationPayoutChangeset,
    IApplicationPayoutRepository,
} from "@grants-stack-indexer/repository";

import { ChangesetHandler } from "../types/index.js";

/**
 * Collection of handlers for application-related operations.
 * Each handler corresponds to a specific Application changeset type.
 */
export type ApplicationPayoutHandlers = {
    [K in ApplicationPayoutChangeset["type"]]: ChangesetHandler<K>;
};

/**
 * Creates handlers for managing application-related operations.
 *
 * @param repository - The application repository instance used for database operations
 * @returns An object containing all application-related handlers
 */
export const createApplicationPayoutHandlers = (
    repository: IApplicationPayoutRepository,
): ApplicationPayoutHandlers => ({
    InsertApplicationPayout: (async (changeset, txConnection): Promise<void> => {
        await repository.insertApplicationPayout(changeset.args.applicationPayout, txConnection);
    }) satisfies ChangesetHandler<"InsertApplicationPayout">,
});
