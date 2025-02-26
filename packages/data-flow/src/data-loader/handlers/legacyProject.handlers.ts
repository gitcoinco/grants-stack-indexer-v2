import { ILegacyProjectRepository, LegacyProjectChangeset } from "@grants-stack-indexer/repository";

import { ChangesetHandler } from "../types/index.js";

/**
 * Collection of handlers for application-related operations.
 * Each handler corresponds to a specific Application changeset type.
 */
export type LegacyProjectHandlers = {
    [K in LegacyProjectChangeset["type"]]: ChangesetHandler<K>;
};

/**
 * Creates handlers for managing application-related operations.
 *
 * @param repository - The application repository instance used for database operations
 * @returns An object containing all application-related handlers
 */
export const createLegacyProjectHandlers = (
    repository: ILegacyProjectRepository,
): LegacyProjectHandlers => ({
    InsertLegacyProject: (async (changeset, txConnection): Promise<void> => {
        await repository.insertLegacyProject(changeset.args.legacyProject, txConnection);
    }) satisfies ChangesetHandler<"InsertLegacyProject">,
});
