import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository" | "logger">;

/**
 * BaseDistributedHandler: Processes 'Distributed' events
 *
 * - Handles distribution events across all strategies.
 * - Creates a changeset to increment the total distributed amount for a round.
 * - Serves as a base class as all strategies share the same logic for this event.
 *
 * @dev:
 * - Strategy handlers that want to handle the Distributed event should create an instance of this class corresponding to the event.
 *
 */

export class BaseDistributedHandler
    implements IEventHandler<"Strategy", "DistributedWithRecipientAddress">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    async handle(): Promise<Changeset[]> {
        const { roundRepository, logger } = this.dependencies;
        const strategyAddress = getAddress(this.event.srcAddress);
        const round = await roundRepository.getRoundByStrategyAddress(
            this.chainId,
            strategyAddress,
        );

        if (!round) {
            //TODO: add logging that round was not found
            logger.info(`Round not found for strategy address ${strategyAddress}`);
            return [];
        }

        return [
            {
                type: "IncrementRoundTotalDistributed",
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    amount: BigInt(this.event.params.amount),
                },
            },
        ];
    }
}
