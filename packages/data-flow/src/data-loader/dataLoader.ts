import {
    Changeset,
    IApplicationPayoutRepository,
    IApplicationRepository,
    IAttestationRepository,
    IDonationRepository,
    IEventRegistryRepository,
    ILegacyProjectRepository,
    IProjectRepository,
    IRoundRepository,
    ITransactionManager,
} from "@grants-stack-indexer/repository";
import { ILogger } from "@grants-stack-indexer/shared";

import { IDataLoader, InvalidChangeset } from "../internal.js";
import {
    createApplicationHandlers,
    createApplicationPayoutHandlers,
    createAttestationHandlers,
    createDonationHandlers,
    createLegacyProjectHandlers,
    createProcessedEventHandlers,
    createProjectHandlers,
    createRoundHandlers,
} from "./handlers/index.js";
import { ChangesetHandlers } from "./types/index.js";

/**
 * DataLoader is responsible for applying changesets to the database.
 * It works by:
 * 1. Taking an array of changesets representing data modifications
 * 2. Validating that handlers exist for all changeset types
 * 3. Sequentially executing each changeset using the appropriate handler
 * 4. Tracking execution results including successes and failures
 * 5. Breaking execution if any changeset fails
 *
 * The handlers are initialized for different entity types (projects, rounds, applications)
 * and stored in a map for lookup during execution.
 */

export class DataLoader implements IDataLoader {
    private readonly handlers: ChangesetHandlers;

    constructor(
        private readonly repositories: {
            project: IProjectRepository;
            round: IRoundRepository;
            application: IApplicationRepository;
            donation: IDonationRepository;
            applicationPayout: IApplicationPayoutRepository;
            eventRegistry: IEventRegistryRepository;
            attestation: IAttestationRepository;
            legacyProject: ILegacyProjectRepository;
        },
        private readonly transactionManager: ITransactionManager,
        private readonly logger: ILogger,
    ) {
        this.handlers = {
            ...createProjectHandlers(repositories.project),
            ...createRoundHandlers(repositories.round),
            ...createApplicationHandlers(repositories.application),
            ...createDonationHandlers(repositories.donation),
            ...createApplicationPayoutHandlers(repositories.applicationPayout),
            ...createProcessedEventHandlers(repositories.eventRegistry),
            ...createAttestationHandlers(repositories.attestation),
            ...createLegacyProjectHandlers(repositories.legacyProject),
        };
    }

    /** @inheritdoc */
    public async applyChanges(changesets: Changeset[]): Promise<void> {
        const invalidTypes = changesets.filter((changeset) => !this.handlers[changeset.type]);
        if (invalidTypes.length > 0) {
            throw new InvalidChangeset(invalidTypes.map((changeset) => changeset.type));
        }

        await this.transactionManager.runInTransaction(async (tx) => {
            this.logger.debug(`Starting transaction on ${changesets.length} changesets...`, {
                className: DataLoader.name,
            });
            for (const changeset of changesets) {
                try {
                    //TODO: inside each handler, we should add zod validation that the args match the expected type
                    await this.handlers[changeset.type](changeset as never, tx);
                } catch (error) {
                    this.logger.debug(
                        `Error applying changeset ${changeset.type}. Rolling back transaction with ${changesets.length} changesets`,
                        {
                            className: DataLoader.name,
                        },
                    );

                    throw error;
                }
            }
        });
        this.logger.debug(`Successfully applied ${changesets.length} changesets`, {
            className: DataLoader.name,
        });
    }
}
