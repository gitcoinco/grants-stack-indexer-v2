import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getDateFromTimestamp } from "../../../../helpers/index.js";
import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository" | "logger">;

/**
 * Handles the TimestampsUpdated event for the Easy Retro Funding strategy.
 *
 * This handler processes updates to the round timestamps:
 * - Validates the round exists for the strategy address
 * - Converts the updated registration and allocation timestamps to dates
 * - Returns a changeset to update the round's application and donation period timestamps
 */
export class ERFTimestampsUpdatedHandler
    implements IEventHandler<"Strategy", "TimestampsUpdatedWithRegistrationAndAllocation">
{
    constructor(
        readonly event: ProcessorEvent<
            "Strategy",
            "TimestampsUpdatedWithRegistrationAndAllocation"
        >,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    /**
     * Handles the TimestampsUpdated event for the Easy Retro Funding strategy.
     * @returns The changeset with an UpdateRound operation.
     * @throws RoundNotFound if the round is not found.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository } = this.dependencies;

        this.dependencies.logger.debug("Starting timestamps update handling", {
            className: ERFTimestampsUpdatedHandler.name,
            methodName: "handle",
            chainId: this.chainId,
            eventDetails: {
                blockNumber: this.event.blockNumber,
                logIndex: this.event.logIndex,
                strategyAddress: this.event.srcAddress,
            },
        });

        const strategyAddress = getAddress(this.event.srcAddress);
        this.dependencies.logger.debug("Fetching round by strategy address", {
            className: ERFTimestampsUpdatedHandler.name,
            methodName: "handle",
            chainId: this.chainId,
            strategyAddress,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        this.dependencies.logger.debug("Round found", {
            className: ERFTimestampsUpdatedHandler.name,
            methodName: "handle",
            roundId: round.id,
            roundAddress: round.strategyAddress,
        });

        const {
            registrationStartTime: strRegistrationStartTime,
            registrationEndTime: strRegistrationEndTime,
            allocationStartTime: strAllocationStartTime,
            allocationEndTime: strAllocationEndTime,
        } = this.event.params;

        this.dependencies.logger.debug("Processing timestamp parameters", {
            className: ERFTimestampsUpdatedHandler.name,
            methodName: "handle",
            rawTimestamps: {
                registrationStart: strRegistrationStartTime,
                registrationEnd: strRegistrationEndTime,
                allocationStart: strAllocationStartTime,
                allocationEnd: strAllocationEndTime,
            },
        });

        const applicationsStartTime = getDateFromTimestamp(BigInt(strRegistrationStartTime));
        const applicationsEndTime = getDateFromTimestamp(BigInt(strRegistrationEndTime));
        const donationsStartTime = getDateFromTimestamp(BigInt(strAllocationStartTime));
        const donationsEndTime = getDateFromTimestamp(BigInt(strAllocationEndTime));

        this.dependencies.logger.debug("Converted timestamps to dates", {
            className: ERFTimestampsUpdatedHandler.name,
            methodName: "handle",
            convertedDates: {
                applicationsStartTime: applicationsStartTime?.toISOString(),
                applicationsEndTime: applicationsEndTime?.toISOString(),
                donationsStartTime: donationsStartTime?.toISOString(),
                donationsEndTime: donationsEndTime?.toISOString(),
            },
        });

        this.dependencies.logger.info("Timestamps update handling completed", {
            className: ERFTimestampsUpdatedHandler.name,
            methodName: "handle",
            roundId: round.id,
            updates: {
                applicationsStartTime: applicationsStartTime?.toISOString(),
                applicationsEndTime: applicationsEndTime?.toISOString(),
                donationsStartTime: donationsStartTime?.toISOString(),
                donationsEndTime: donationsEndTime?.toISOString(),
            },
            previousValues: {
                applicationsStartTime: round.applicationsStartTime?.toISOString(),
                applicationsEndTime: round.applicationsEndTime?.toISOString(),
                donationsStartTime: round.donationsStartTime?.toISOString(),
                donationsEndTime: round.donationsEndTime?.toISOString(),
            },
        });

        return [
            {
                type: "UpdateRound",
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    round: {
                        applicationsStartTime,
                        applicationsEndTime,
                        donationsStartTime,
                        donationsEndTime,
                    },
                },
            },
        ];
    }
}
