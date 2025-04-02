import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getDateFromTimestamp } from "../../../../helpers/index.js";
import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository" | "logger">;

/**
 * Handles the TimestampsUpdated event for the Donation Voting Merkle Distribution Direct Transfer strategy.
 *
 * This handler processes updates to the round timestamps:
 * - Validates the round exists for the strategy address
 * - Converts the updated registration and allocation timestamps to dates
 * - Returns a changeset to update the round's application and donation period timestamps
 */
export class DVMDTimestampsUpdatedHandler
    implements IEventHandler<"Strategy", "TimestampsUpdatedWithRegistrationAndAllocation">
{
    constructor(
        readonly event: ProcessorEvent<
            "Strategy",
            "TimestampsUpdatedWithRegistrationAndAllocation"
        >,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing DVMDTimestampsUpdatedHandler", {
            className: "DVMDTimestampsUpdatedHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
            transactionHash: this.event.transactionFields.hash,
        });
    }

    /**
     * Handles the TimestampsUpdated event for the Donation Voting Merkle Distribution Direct Transfer strategy.
     * @returns The changeset with an UpdateRound operation.
     * @throws RoundNotFound if the round is not found.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, logger } = this.dependencies;
        const strategyAddress = getAddress(this.event.srcAddress);

        logger?.debug("Starting timestamps update handling", {
            className: "DVMDTimestampsUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
        });

        logger?.debug("Fetching round by strategy address", {
            className: "DVMDTimestampsUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        const {
            registrationStartTime: strRegistrationStartTime,
            registrationEndTime: strRegistrationEndTime,
            allocationStartTime: strAllocationStartTime,
            allocationEndTime: strAllocationEndTime,
        } = this.event.params;

        logger?.debug("Processing timestamp updates", {
            className: "DVMDTimestampsUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            registrationStartTime: strRegistrationStartTime,
            registrationEndTime: strRegistrationEndTime,
            allocationStartTime: strAllocationStartTime,
            allocationEndTime: strAllocationEndTime,
        });

        const applicationsStartTime = getDateFromTimestamp(BigInt(strRegistrationStartTime));
        const applicationsEndTime = getDateFromTimestamp(BigInt(strRegistrationEndTime));
        const donationsStartTime = getDateFromTimestamp(BigInt(strAllocationStartTime));
        const donationsEndTime = getDateFromTimestamp(BigInt(strAllocationEndTime));

        logger?.debug("Creating round update changeset", {
            className: "DVMDTimestampsUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            applicationsStartTime: applicationsStartTime?.toISOString(),
            applicationsEndTime: applicationsEndTime?.toISOString(),
            donationsStartTime: donationsStartTime?.toISOString(),
            donationsEndTime: donationsEndTime?.toISOString(),
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
                        donationsStartTime,
                        donationsEndTime,
                    },
                },
            },
        ];

        logger?.info("Timestamps update completed", {
            className: "DVMDTimestampsUpdatedHandler",
            methodName: "handle",
            roundId: round.id,
            registrationPeriod: `${applicationsStartTime?.toISOString()} - ${applicationsEndTime?.toISOString()}`,
            allocationPeriod: `${donationsStartTime?.toISOString()} - ${donationsEndTime?.toISOString()}`,
            changeCount: changes.length,
        });

        return changes;
    }
}
