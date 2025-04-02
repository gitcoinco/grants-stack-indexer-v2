import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getDateFromTimestamp } from "../../../../helpers/index.js";
import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository" | "logger">;

/**
 * Handles the TimestampsUpdated event for the Direct Grants Simple strategy.
 *
 * This handler processes updates to the round timestamps:
 * - Validates the round exists for the strategy address
 * - Converts the updated registration timestamps to dates
 * - Returns a changeset to update the round's application timestamps
 */
export class DGSimpleTimestampsUpdatedHandler
    implements IEventHandler<"Strategy", "TimestampsUpdated">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "TimestampsUpdated">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing DGSimpleTimestampsUpdatedHandler", {
            className: "DGSimpleTimestampsUpdatedHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
            transactionHash: this.event.transactionFields.hash,
        });
    }

    /**
     * Handles the TimestampsUpdated event for the Direct Grants Simple strategy.
     * @returns The changeset with an UpdateRound operation.
     * @throws RoundNotFound if the round is not found.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, logger } = this.dependencies;
        const strategyAddress = getAddress(this.event.srcAddress);

        logger?.debug("Starting timestamps update handling", {
            className: "DGSimpleTimestampsUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
        });

        logger?.debug("Fetching round by strategy address", {
            className: "DGSimpleTimestampsUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        const { startTime: strStartTime, endTime: strEndTime } = this.event.params;

        logger?.debug("Processing timestamp updates", {
            className: "DGSimpleTimestampsUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            startTime: strStartTime,
            endTime: strEndTime,
        });

        const applicationsStartTime = getDateFromTimestamp(BigInt(strStartTime));
        const applicationsEndTime = getDateFromTimestamp(BigInt(strEndTime));

        logger?.debug("Creating round update changeset", {
            className: "DGSimpleTimestampsUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            applicationsStartTime: applicationsStartTime?.toISOString(),
            applicationsEndTime: applicationsEndTime?.toISOString(),
        });

        const changes = [
            {
                type: "UpdateRound" as const,
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    round: {
                        applicationsStartTime,
                        applicationsEndTime,
                    },
                },
            },
        ];

        logger?.info("Timestamps update completed", {
            className: "DGSimpleTimestampsUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            startTime: applicationsStartTime?.toISOString(),
            endTime: applicationsEndTime?.toISOString(),
            changeCount: changes.length,
        });

        return changes;
    }
}
