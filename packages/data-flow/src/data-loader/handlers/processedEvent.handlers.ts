import {
    IEventRegistryRepository,
    ProcessedEventChangeset,
} from "@grants-stack-indexer/repository";

import { ChangesetHandler } from "../types/index.js";

/**
 * Collection of handlers for application-related operations.
 * Each handler corresponds to a specific Application changeset type.
 */
export type ProcessedEventHandlers = {
    [K in ProcessedEventChangeset["type"]]: ChangesetHandler<K>;
};

/**
 * Creates handlers for managing application-related operations.
 *
 * @param repository - The application repository instance used for database operations
 * @returns An object containing all application-related handlers
 */
export const createProcessedEventHandlers = (
    repository: IEventRegistryRepository,
): ProcessedEventHandlers => ({
    InsertProcessedEvent: (async (changeset, txConnection): Promise<void> => {
        await repository.saveLastProcessedEvent(
            changeset.args.chainId,
            changeset.args.processedEvent,
            txConnection,
        );
    }) satisfies ChangesetHandler<"InsertProcessedEvent">,
});
