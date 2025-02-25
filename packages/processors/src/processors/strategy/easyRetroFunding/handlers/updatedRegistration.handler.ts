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

        const { status: strStatus } = this.event.params;
        const status = Number(strStatus);

        if (!isValidApplicationStatus(status)) {
            logger.warn(
                `[ERFUpdatedRegistrationHandler] Invalid status: ${this.event.params.status}`,
            );

            return [];
        }

        const project = await projectRepository.getProjectByAnchorOrThrow(
            this.chainId,
            getAddress(this.event.params.recipientId),
        );
        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            getAddress(this.event.srcAddress),
        );
        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            round.id,
            project.anchorAddress!,
        );

        const encodedData = this.event.params.data;
        const values = decodeDVMDApplicationData(encodedData);

        const metadata = await metadataProvider.getMetadata(values.metadata.pointer);

        const statusString = ApplicationStatus[status] as Application["status"];

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
}
