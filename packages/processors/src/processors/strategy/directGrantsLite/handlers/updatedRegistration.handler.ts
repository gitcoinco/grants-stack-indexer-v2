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
 * Handles the UpdatedRegistration event for the Direct Grants Lite strategy.
 *
 * This handler processes updates to project registrations/applications in a round:
 * - Validates the updated application status is valid (between 1-3)
 * - Decodes the updated application metadata and data
 * - Returns a changeset to update the application record
 */

export class DGLiteUpdatedRegistrationHandler
    implements IEventHandler<"Strategy", "UpdatedRegistrationWithStatus">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing DGLiteUpdatedRegistrationHandler", {
            className: "DGLiteUpdatedRegistrationHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
            transactionHash: this.event.transactionFields.hash,
        });
    }

    /**
     * Handles the UpdatedRegistrationWithStatus event for the Direct Grants Lite strategy.
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

        const { status: strStatus, recipientId, data: encodedData } = this.event.params;
        const status = Number(strStatus);

        logger?.debug("Starting registration update handling", {
            className: "DGLiteUpdatedRegistrationHandler",
            methodName: "handle",
            recipientId,
            status,
            encodedDataLength: encodedData.length,
        });

        if (!isValidApplicationStatus(status)) {
            logger?.warn("Invalid application status received", {
                className: "DGLiteUpdatedRegistrationHandler",
                methodName: "handle",
                status: strStatus,
                recipientId,
            });
            return [];
        }

        logger?.debug("Fetching project by anchor", {
            className: "DGLiteUpdatedRegistrationHandler",
            methodName: "handle",
            recipientId: getAddress(recipientId),
            chainId: this.chainId,
        });

        const project = await projectRepository.getProjectByAnchorOrThrow(
            this.chainId,
            getAddress(recipientId),
        );

        logger?.debug("Fetching round by strategy address", {
            className: "DGLiteUpdatedRegistrationHandler",
            methodName: "handle",
            strategyAddress: this.event.srcAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            getAddress(this.event.srcAddress),
        );

        logger?.debug("Fetching application by anchor address", {
            className: "DGLiteUpdatedRegistrationHandler",
            methodName: "handle",
            roundId: round.id,
            anchorAddress: project.anchorAddress,
        });

        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            round.id,
            project.anchorAddress!,
        );

        logger?.debug("Decoding application data", {
            className: "DGLiteUpdatedRegistrationHandler",
            methodName: "handle",
            applicationId: application.id,
            encodedDataLength: encodedData.length,
        });

        const values = decodeDVMDApplicationData(encodedData);

        logger?.debug("Fetching updated metadata", {
            className: "DGLiteUpdatedRegistrationHandler",
            methodName: "handle",
            applicationId: application.id,
            metadataPointer: values.metadata.pointer,
        });

        const metadata = await metadataProvider.getMetadata(values.metadata.pointer);
        const statusString = ApplicationStatus[status] as Application["status"];

        logger?.debug("Creating status update", {
            className: "DGLiteUpdatedRegistrationHandler",
            methodName: "handle",
            applicationId: application.id,
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

        const changes = [
            {
                type: "UpdateApplication" as const,
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

        logger?.info("Registration update completed", {
            className: "DGLiteUpdatedRegistrationHandler",
            methodName: "handle",
            applicationId: application.id,
            roundId: round.id,
            projectId: project.id,
            oldStatus: application.status,
            newStatus: statusString,
            metadataUpdated: metadata !== null,
            changeCount: changes.length,
        });

        return changes;
    }
}
