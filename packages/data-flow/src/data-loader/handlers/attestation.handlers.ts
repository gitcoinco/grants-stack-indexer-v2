import { AttestationChangeset, IAttestationRepository } from "@grants-stack-indexer/repository";

import { ChangesetHandler } from "../types/index.js";

/**
 * Collection of handlers for application-related operations.
 * Each handler corresponds to a specific Application changeset type.
 */
export type AttestationHandlers = {
    [K in AttestationChangeset["type"]]: ChangesetHandler<K>;
};

/**
 * Creates handlers for managing application-related operations.
 *
 * @param repository - The application repository instance used for database operations
 * @returns An object containing all application-related handlers
 */
export const createAttestationHandlers = (
    repository: IAttestationRepository,
): AttestationHandlers => ({
    InsertAttestation: (async (changeset, txConnection): Promise<void> => {
        await repository.insertAttestation(
            changeset.args.attestationData,
            changeset.args.transactionsData,
            txConnection,
        );
    }) satisfies ChangesetHandler<"InsertAttestation">,
});
