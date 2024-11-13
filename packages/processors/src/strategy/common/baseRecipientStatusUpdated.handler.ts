import StatusesBitmap from "statuses-bitmap";
import { getAddress } from "viem";

import { Application, Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { ApplicationStatus, IEventHandler, ProcessorDependencies } from "../../internal.js";
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
    }

    /**
     * Handles the RecipientStatusUpdated event by processing status updates for multiple applications.
     * @returns An array of changesets to update application statuses.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository } = this.dependencies;

        const strategyAddress = getAddress(this.event.srcAddress);
        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        const applicationsToUpdate = await this.getApplicationsToUpdate(round.id);

        return applicationsToUpdate.map(({ application, status }) => {
            const statusString = ApplicationStatus[status] as Application["status"];
            return {
                type: "UpdateApplication",
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
    }

    /**
     * Gets the list of applications that need to be updated based on the bitmap row
     * @param roundId - The ID of the round.
     * @returns An array of application updates.
     */
    private async getApplicationsToUpdate(roundId: string): Promise<ApplicationUpdate[]> {
        const { rowIndex, fullRow } = this.event.params;
        this.bitmap.setRow(rowIndex, fullRow);

        const startIndex = rowIndex * this.bitmap.itemsPerRow;
        const applications: { application: Application; status: number }[] = [];

        for (let i = startIndex; i < startIndex + this.bitmap.itemsPerRow; i++) {
            const status = this.bitmap.getStatus(i);
            if (isValidApplicationStatus(status)) {
                const application =
                    await this.dependencies.applicationRepository.getApplicationById(
                        i.toString(),
                        this.chainId,
                        roundId,
                    );

                if (application) {
                    applications.push({
                        application,
                        status,
                    });
                }
            }
        }

        return applications;
    }
}
