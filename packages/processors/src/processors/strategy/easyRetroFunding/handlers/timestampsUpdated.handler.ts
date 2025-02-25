import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getDateFromTimestamp } from "../../../../helpers/index.js";
import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository">;

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
        const strategyAddress = getAddress(this.event.srcAddress);
        const round = await this.dependencies.roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        const {
            registrationStartTime: strRegistrationStartTime,
            registrationEndTime: strRegistrationEndTime,
            allocationStartTime: strAllocationStartTime,
            allocationEndTime: strAllocationEndTime,
        } = this.event.params;

        const applicationsStartTime = getDateFromTimestamp(BigInt(strRegistrationStartTime));
        const applicationsEndTime = getDateFromTimestamp(BigInt(strRegistrationEndTime));
        const donationsStartTime = getDateFromTimestamp(BigInt(strAllocationStartTime));
        const donationsEndTime = getDateFromTimestamp(BigInt(strAllocationEndTime));

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
