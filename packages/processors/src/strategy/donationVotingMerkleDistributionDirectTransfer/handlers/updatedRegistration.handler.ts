// import StatusesBitmap from "statuses-bitmap";
import { Address, getAddress } from "viem";

import { Application, Changeset, Project, Round } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import {
    ApplicationNotFound,
    ApplicationStatus,
    IEventHandler,
    ProcessorDependencies,
    ProjectNotFound,
    RoundNotFound,
} from "../../../internal.js";
import { createStatusUpdate, isValidApplicationStatus } from "../../helpers/index.js";
import { decodeDVMDApplicationData } from "../helpers/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    | "logger"
    | "roundRepository"
    | "applicationRepository"
    | "projectRepository"
    | "metadataProvider"
>;

/**
 * Handles the UpdatedRegistration event for the Donation Voting Merkle Distribution Direct Transfer strategy.
 *
 * This handler processes updates to project registrations/applications in a round:
 * - Validates the updated application status is valid (between 1-3)
 * - Decodes the updated application metadata and data
 * - Returns a changeset to update the application record
 */

export class DVMDUpdatedRegistrationHandler
    implements IEventHandler<"Strategy", "UpdatedRegistrationWithStatus">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    async handle(): Promise<Changeset[]> {
        const { metadataProvider, logger } = this.dependencies;

        if (!isValidApplicationStatus(this.event.params.status)) {
            logger.warn(
                `[DVMDUpdatedRegistrationHandler] Invalid status: ${this.event.params.status}`,
            );

            return [];
        }

        const project = await this.getProjectOrThrow(this.event.params.recipientId);
        const round = await this.getRoundOrThrow(this.event.srcAddress);
        const application = await this.getApplicationOrThrow(round.id, project.anchorAddress!);

        const encodedData = this.event.params.data;
        const values = decodeDVMDApplicationData(encodedData);

        const metadata = await metadataProvider.getMetadata(values.metadata.pointer);

        const statusString = ApplicationStatus[this.event.params.status] as Application["status"];

        const statusUpdates = createStatusUpdate({
            application,
            newStatus: statusString,
            blockNumber: this.event.blockNumber,
            blockTimestamp: this.event.blockTimestamp,
        });

        return [
            {
                type: "UpdateApplication",
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    applicationId: application.id,
                    application: {
                        ...application,
                        ...statusUpdates,
                        metadataCid: values.metadata.pointer,
                        metadata: metadata ?? null,
                    },
                },
            },
        ];
    }

    /**
     * Get the round by the strategy address.
     * @param strategyAddress - The strategy address.
     * @returns The round.
     * @throws If the round is not found.
     */
    private async getRoundOrThrow(strategyAddress: Address): Promise<Round> {
        const round = await this.dependencies.roundRepository.getRoundByStrategyAddress(
            this.chainId,
            strategyAddress,
        );

        if (!round) {
            this.dependencies.logger.warn(
                `RecipientStatusUpdated: Round not found for strategy address ${strategyAddress}`,
            );
            throw new RoundNotFound(this.chainId, strategyAddress);
        }

        return round;
    }

    /**
     * Get the project by the anchor address.
     * @param anchorAddress - The anchor address.
     * @returns The project.
     * @throws If the project is not found.
     */
    private async getProjectOrThrow(anchorAddress: Address): Promise<Project> {
        const _anchorAddress = getAddress(anchorAddress);
        const project = await this.dependencies.projectRepository.getProjectByAnchor(
            this.chainId,
            _anchorAddress,
        );

        if (!project) {
            throw new ProjectNotFound(this.chainId, _anchorAddress);
        }

        return project;
    }

    /**
     * Get the application by the anchor address.
     * @param roundId - The round ID.
     * @param anchorAddress - The anchor address.
     * @returns The application.
     * @throws If the application is not found.
     */
    private async getApplicationOrThrow(
        roundId: Round["id"],
        anchorAddress: Address,
    ): Promise<Application> {
        const application =
            await this.dependencies.applicationRepository.getApplicationByAnchorAddress(
                this.chainId,
                roundId,
                anchorAddress,
            );

        if (!application) {
            throw new ApplicationNotFound(this.chainId, roundId, anchorAddress);
        }

        return application;
    }
}
