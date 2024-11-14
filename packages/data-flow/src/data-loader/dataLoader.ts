import {
    Changeset,
    IApplicationPayoutRepository,
    IApplicationRepository,
    IDonationRepository,
    IProjectRepository,
    IRoundRepository,
} from "@grants-stack-indexer/repository";
import { ILogger, stringify } from "@grants-stack-indexer/shared";

import { ExecutionResult, IDataLoader, InvalidChangeset } from "../internal.js";
import {
    createApplicationHandlers,
    createApplicationPayoutHandlers,
    createDonationHandlers,
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
        },
        private readonly logger: ILogger,
    ) {
        this.handlers = {
            ...createProjectHandlers(repositories.project),
            ...createRoundHandlers(repositories.round),
            ...createApplicationHandlers(repositories.application),
            ...createDonationHandlers(repositories.donation),
            ...createApplicationPayoutHandlers(repositories.applicationPayout),
        };
    }

    /** @inheritdoc */
    public async applyChanges(changesets: Changeset[]): Promise<ExecutionResult> {
        const result: ExecutionResult = {
            changesets: [],
            numExecuted: 0,
            numSuccessful: 0,
            numFailed: 0,
            errors: [],
        };

        const invalidTypes = changesets.filter((changeset) => !this.handlers[changeset.type]);
        if (invalidTypes.length > 0) {
            throw new InvalidChangeset(invalidTypes.map((changeset) => changeset.type));
        }

        //TODO: research how to manage transactions so we can rollback on error
        for (const changeset of changesets) {
            result.numExecuted++;
            try {
                //TODO: inside each handler, we should add zod validation that the args match the expected type
                await this.handlers[changeset.type](changeset as never);
                result.changesets.push(changeset.type);
                result.numSuccessful++;
            } catch (error) {
                result.numFailed++;
                result.errors.push(
                    `Failed to apply changeset ${changeset.type}: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
                this.logger.error(`${stringify(error, Object.getOwnPropertyNames(error))}`);
                break;
            }
        }

        return result;
    }
}
