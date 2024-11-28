import type { Changeset } from "@grants-stack-indexer/repository";
import type { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";
import { getToken, UnknownToken } from "@grants-stack-indexer/shared";

import type { IEventHandler, ProcessorDependencies } from "../../../internal.js";
import { getTokenAmountInUsd } from "../../../helpers/index.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository" | "logger" | "pricingProvider">;

/**
 * Handles the PoolFunded event for the Allo protocol.
 *
 * This handler performs the following core actions when a pool is funded:
 * - Fetches the round metadata from the metadata provider.
 * - Returns the changeset to update the round with the new metadata.
 */
export class PoolFundedHandler implements IEventHandler<"Allo", "PoolFunded"> {
    constructor(
        readonly event: ProcessorEvent<"Allo", "PoolFunded">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    async handle(): Promise<Changeset[]> {
        const poolId = this.event.params.poolId.toString();
        const fundedAmount = this.event.params.amount;
        const { roundRepository, pricingProvider } = this.dependencies;

        const round = await roundRepository.getRoundById(this.chainId, poolId);

        if (!round) {
            return [];
        }
        const token = getToken(this.chainId, round.matchTokenAddress);

        //TODO: Review this on Advace Recovery Milestone
        if (!token) throw new UnknownToken(round.matchTokenAddress, this.chainId);

        const { amountInUsd } = await getTokenAmountInUsd(
            pricingProvider,
            token,
            fundedAmount,
            this.event.blockTimestamp,
        );

        return [
            {
                type: "IncrementRoundFundedAmount",
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    fundedAmount,
                    fundedAmountInUsd: amountInUsd,
                },
            },
        ];
    }
}
