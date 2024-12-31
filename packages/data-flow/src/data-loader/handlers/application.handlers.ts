import { ApplicationChangeset, IApplicationRepository } from "@grants-stack-indexer/repository";

import { ChangesetHandler } from "../types/index.js";

/**
 * Collection of handlers for application-related operations.
 * Each handler corresponds to a specific Application changeset type.
 */
export type ApplicationHandlers = {
    [K in ApplicationChangeset["type"]]: ChangesetHandler<K>;
};

/**
 * Creates handlers for managing application-related operations.
 *
 * @param repository - The application repository instance used for database operations
 * @returns An object containing all application-related handlers
 */
export const createApplicationHandlers = (
    repository: IApplicationRepository,
): ApplicationHandlers => ({
    InsertApplication: (async (changeset, txConnection): Promise<void> => {
        await repository.insertApplication(changeset.args, txConnection);
    }) satisfies ChangesetHandler<"InsertApplication">,

    UpdateApplication: (async (changeset, txConnection): Promise<void> => {
        const { chainId, roundId, applicationId, application } = changeset.args;
        await repository.updateApplication(
            { chainId, roundId, id: applicationId },
            application,
            txConnection,
        );
    }) satisfies ChangesetHandler<"UpdateApplication">,
});
