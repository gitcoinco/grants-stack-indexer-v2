import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import type { IEventHandler, ProcessorDependencies } from "../../../internal.js";
import { getDateFromTimestamp } from "../../../helpers/index.js";
import { RoundNotFound } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository">;

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
    ) {}

    /**
     * Handles the TimestampsUpdated event for the Donation Voting Merkle Distribution Direct Transfer strategy.
     * @returns The changeset with an UpdateRound operation.
     * @throws RoundNotFound if the round is not found.
     */
    async handle(): Promise<Changeset[]> {
        const strategyAddress = getAddress(this.event.srcAddress);
        const round = await this.dependencies.roundRepository.getRoundByStrategyAddress(
            this.chainId,
            strategyAddress,
        );

        if (!round) {
            throw new RoundNotFound(this.chainId, strategyAddress);
        }

        const {
            registrationStartTime,
            registrationEndTime,
            allocationStartTime,
            allocationEndTime,
        } = this.event.params;

        const applicationsStartTime = getDateFromTimestamp(registrationStartTime);
        const applicationsEndTime = getDateFromTimestamp(registrationEndTime);
        const donationsStartTime = getDateFromTimestamp(allocationStartTime);
        const donationsEndTime = getDateFromTimestamp(allocationEndTime);

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
