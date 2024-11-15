import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getDateFromTimestamp } from "../../../../helpers/index.js";
import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository">;

/**
 * Handles the TimestampsUpdated event for the Direct Grants Lite strategy.
 *
 * This handler processes updates to the round timestamps:
 * - Validates the round exists for the strategy address
 * - Converts the updated registration timestamps to dates
 * - Returns a changeset to update the round's application timestamps
 */
export class DGLiteTimestampsUpdatedHandler
    implements IEventHandler<"Strategy", "TimestampsUpdated">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "TimestampsUpdated">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    /**
     * Handles the TimestampsUpdated event for the Direct Grants Lite strategy.
     * @returns The changeset with an UpdateRound operation.
     * @throws RoundNotFound if the round is not found.
     */
    async handle(): Promise<Changeset[]> {
        const strategyAddress = getAddress(this.event.srcAddress);
        const round = await this.dependencies.roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        const { startTime: strStartTime, endTime: strEndTime } = this.event.params;

        const applicationsStartTime = getDateFromTimestamp(BigInt(strStartTime));
        const applicationsEndTime = getDateFromTimestamp(BigInt(strEndTime));

        return [
            {
                type: "UpdateRound",
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
    }
}
