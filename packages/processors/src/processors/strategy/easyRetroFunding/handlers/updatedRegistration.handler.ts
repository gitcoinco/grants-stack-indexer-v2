import { getAddress } from "viem";

import { Application, Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { ApplicationStatus, IEventHandler, ProcessorDependencies } from "../../../../internal.js";
import {
    createStatusUpdate,
    decodeDVMDApplicationData,
    isValidApplicationStatus,
} from "../../helpers/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    | "logger"
    | "roundRepository"
    | "applicationRepository"
    | "projectRepository"
    | "metadataProvider"
>;

/**
 * Handles the UpdatedRegistration event for the Easy Retro Funding strategy.
 *
 * This handler processes updates to project registrations/applications in a round:
 * - Validates the updated application status is valid (between 1-3)
 * - Decodes the updated application metadata and data
 * - Returns a changeset to update the application record
 */

export class ERFUpdatedRegistrationHandler
    implements IEventHandler<"Strategy", "UpdatedRegistrationWithStatus">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    /**
     * Handles the UpdatedRegistrationWithStatus event for the Easy Retro Funding strategy.
     * @returns The changeset with an UpdateApplication operation.
     * @throws ProjectNotFound if the project is not found.
     * @throws RoundNotFound if the round is not found.
     * @throws ApplicationNotFound if the application is not found.
     */
    async handle(): Promise<Changeset[]> {
        const {
            metadataProvider,
            logger,
            roundRepository,
            applicationRepository,
            projectRepository,
        } = this.dependencies;

        logger.debug("Starting ERF registration update handling", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            chainId: this.chainId,
            eventDetails: {
                blockNumber: this.event.blockNumber,
                logIndex: this.event.logIndex,
                recipientId: this.event.params.recipientId,
                strategyAddress: this.event.srcAddress,
                encodedDataLength: this.event.params.data.length,
            },
        });

        const { status: strStatus } = this.event.params;
        const status = Number(strStatus);

        logger.debug("Validating application status", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            rawStatus: strStatus,
            parsedStatus: status,
            isValid: isValidApplicationStatus(status),
        });

        if (!isValidApplicationStatus(status)) {
            logger.warn("Invalid application status", {
                className: ERFUpdatedRegistrationHandler.name,
                methodName: "handle",
                status: strStatus,
                recipientId: this.event.params.recipientId,
            });

            return [];
        }

        logger.debug("Fetching project details", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            recipientId: this.event.params.recipientId,
            chainId: this.chainId,
        });

        const project = await projectRepository.getProjectByAnchorOrThrow(
            this.chainId,
            getAddress(this.event.params.recipientId),
        );

        logger.debug("Project found", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            projectId: project.id,
            anchorAddress: project.anchorAddress,
        });

        logger.debug("Fetching round details", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            strategyAddress: this.event.srcAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            getAddress(this.event.srcAddress),
        );

        logger.debug("Round found", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            roundId: round.id,
            roundAddress: round.strategyAddress,
        });

        logger.debug("Fetching application details", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            roundId: round.id,
            anchorAddress: project.anchorAddress,
        });

        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            round.id,
            project.anchorAddress!,
        );

        logger.debug("Application found", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            applicationId: application.id,
            currentStatus: application.status,
        });

        logger.debug("Decoding application data", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            encodedDataLength: this.event.params.data.length,
        });

        const encodedData = this.event.params.data;
        const values = decodeDVMDApplicationData(encodedData);

        logger.debug("Application data decoded", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            metadataPointer: values.metadata.pointer,
        });

        logger.debug("Fetching metadata", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            metadataPointer: values.metadata.pointer,
        });

        const metadata = await metadataProvider.getMetadata(values.metadata.pointer);

        logger.debug("Metadata fetched", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            hasMetadata: !!metadata,
        });

        const statusString = ApplicationStatus[status] as Application["status"];

        logger.debug("Creating status update", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            currentStatus: application.status,
            newStatus: statusString,
            blockNumber: this.event.blockNumber,
        });

        const statusUpdates = createStatusUpdate({
            application,
            newStatus: statusString,
            blockNumber: this.event.blockNumber,
            blockTimestamp: this.event.blockTimestamp,
        });

        logger.info("Registration update handling completed", {
            className: ERFUpdatedRegistrationHandler.name,
            methodName: "handle",
            applicationId: application.id,
            roundId: round.id,
            projectId: project.id,
            oldStatus: application.status,
            newStatus: statusString,
            metadataUpdated: !!metadata,
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
}
