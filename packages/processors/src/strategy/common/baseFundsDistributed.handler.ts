import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../internal.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "roundRepository" | "applicationRepository" | "logger"
>;

/**
 * BaseFundsDistributedHandler: Processes 'FundsDistributed' events
 *
 * - Handles funds distributed events across all strategies.
 * - Creates two changesets:
 *     1. UpdateApplication: Updates the application with the transaction hash.
 *     2. IncrementRoundTotalDistributed: Increments the total distributed amount for a round.
 * - Serves as a base class as all strategies share the same logic for this event.
 *
 * @dev:
 * - Strategy handlers that want to handle the FundsDistributed event should create an instance of this class corresponding to the event.
 *
 */

export class BaseFundsDistributedHandler implements IEventHandler<"Strategy", "FundsDistributed"> {
    constructor(
        readonly event: ProcessorEvent<"Strategy", "FundsDistributed">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    /**
     * Handles the FundsDistributed event.
     * @throws {RoundNotFound} if the round is not found.
     * @throws {ApplicationNotFound} if the application is not found.
     * @returns An array of changesets with the following:
     *     1. UpdateApplication: Updates the application with the transaction hash.
     *     2. IncrementRoundTotalDistributed: Increments the total distributed amount for a round.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, applicationRepository } = this.dependencies;

        const strategyAddress = getAddress(this.event.srcAddress);
        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        const roundId = round.id;
        const anchorAddress = getAddress(this.event.params.recipientId);
        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            roundId,
            anchorAddress,
        );

        return [
            {
                type: "UpdateApplication",
                args: {
                    chainId: this.chainId,
                    roundId,
                    applicationId: application.id,
                    application: {
                        distributionTransaction: this.event.transactionFields.hash,
                    },
                },
            },
            {
                type: "IncrementRoundTotalDistributed",
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    amount: this.event.params.amount,
                },
            },
        ];
    }
}
