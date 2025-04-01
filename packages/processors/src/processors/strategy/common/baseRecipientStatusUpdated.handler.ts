import StatusesBitmap from "statuses-bitmap";
import { getAddress } from "viem";

import { Application, Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { ApplicationStatus, IEventHandler, ProcessorDependencies } from "../../../internal.js";
import { createStatusUpdate, isValidApplicationStatus } from "../helpers/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "logger" | "roundRepository" | "applicationRepository"
>;

type ApplicationUpdate = {
    application: Application;
    status: number;
};

/**
 * BaseRecipientStatusUpdatedHandler: Processes 'RecipientStatusUpdated' events
 *
 * - Decodes a bitmap containing status updates for multiple applications
 * - Validates each status is valid (between 1-3)
 * - Creates changesets to update application statuses in bulk
 * - Serves as a base class as all strategies share the same logic for this event
 *
 * @dev:
 * - Strategy handlers that want to handle the RecipientStatusUpdated event should create an instance of this class corresponding to the event.
 *
 */
export class BaseRecipientStatusUpdatedHandler
    implements IEventHandler<"Strategy", "RecipientStatusUpdatedWithFullRow">
{
    private readonly bitmap: StatusesBitmap;

    constructor(
        readonly event: ProcessorEvent<"Strategy", "RecipientStatusUpdatedWithFullRow">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.bitmap = new StatusesBitmap(256n, 4n);
        this.dependencies.logger?.debug("Initializing BaseRecipientStatusUpdatedHandler", {
            className: "BaseRecipientStatusUpdatedHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
            rowIndex: this.event.params.rowIndex,
            itemsPerRow: this.bitmap.itemsPerRow,
        });
    }

    /**
     * Handles the RecipientStatusUpdated event by processing status updates for multiple applications.
     * @returns An array of changesets to update application statuses.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, logger } = this.dependencies;
        const strategyAddress = getAddress(this.event.srcAddress);

        logger?.debug("Starting recipient status update handling", {
            className: "BaseRecipientStatusUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            rowIndex: this.event.params.rowIndex,
            fullRow: this.event.params.fullRow,
        });

        logger?.debug("Fetching round by strategy address", {
            className: "BaseRecipientStatusUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        logger?.debug("Getting applications to update", {
            className: "BaseRecipientStatusUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            rowIndex: this.event.params.rowIndex,
        });

        const applicationsToUpdate = await this.getApplicationsToUpdate(round.id);

        logger?.debug("Creating status update changesets", {
            className: "BaseRecipientStatusUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            applicationCount: applicationsToUpdate.length,
        });

        const changes = applicationsToUpdate.map(({ application, status }) => {
            const statusString = ApplicationStatus[status] as Application["status"];
            logger?.debug("Creating status update for application", {
                className: "BaseRecipientStatusUpdatedHandler",
                methodName: "handle",
                applicationId: application.id,
                currentStatus: application.status,
                newStatus: statusString,
            });

            return {
                type: "UpdateApplication" as const,
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    applicationId: application.id,
                    application: createStatusUpdate({
                        application,
                        newStatus: statusString,
                        blockNumber: this.event.blockNumber,
                        blockTimestamp: this.event.blockTimestamp,
                    }),
                },
            };
        });

        logger?.info("Recipient status updates completed", {
            className: "BaseRecipientStatusUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            updatedCount: changes.length,
        });

        return changes;
    }

    /**
     * Gets the list of applications that need to be updated based on the bitmap row
     * @param roundId - The ID of the round.
     * @returns An array of application updates.
     */
    private async getApplicationsToUpdate(roundId: string): Promise<ApplicationUpdate[]> {
        const { logger } = this.dependencies;
        const { rowIndex, fullRow } = this.event.params;

        logger?.debug("Processing bitmap row", {
            className: "BaseRecipientStatusUpdatedHandler",
            methodName: "getApplicationsToUpdate",
            rowIndex,
            fullRow,
        });

        this.bitmap.setRow(BigInt(rowIndex), BigInt(fullRow));

        const startIndex = BigInt(rowIndex) * BigInt(this.bitmap.itemsPerRow);
        const applications: { application: Application; status: number }[] = [];

        logger?.debug("Starting application status scan", {
            className: "BaseRecipientStatusUpdatedHandler",
            methodName: "getApplicationsToUpdate",
            startIndex: startIndex.toString(),
            itemsPerRow: this.bitmap.itemsPerRow,
        });

        for (let i = startIndex; i < startIndex + this.bitmap.itemsPerRow; i++) {
            const status = this.bitmap.getStatus(i);

            logger?.debug("Processing application index", {
                className: "BaseRecipientStatusUpdatedHandler",
                methodName: "getApplicationsToUpdate",
                index: i.toString(),
                status,
                isValidStatus: isValidApplicationStatus(status),
            });

            if (isValidApplicationStatus(status)) {
                const application =
                    await this.dependencies.applicationRepository.getApplicationById(
                        i.toString(),
                        this.chainId,
                        roundId,
                    );

                if (application) {
                    logger?.debug("Found valid application for update", {
                        className: "BaseRecipientStatusUpdatedHandler",
                        methodName: "getApplicationsToUpdate",
                        applicationId: application.id,
                        status,
                    });
                    applications.push({ application, status });
                }
            }
        }

        logger?.debug("Application status scan completed", {
            className: "BaseRecipientStatusUpdatedHandler",
            methodName: "getApplicationsToUpdate",
            validApplicationsFound: applications.length,
        });

        return applications;
    }
}
