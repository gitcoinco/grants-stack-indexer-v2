import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

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
    ) {
        this.dependencies.logger?.debug("Initializing BaseFundsDistributedHandler", {
            className: "BaseFundsDistributedHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
        });
    }

    /**
     * Handles the FundsDistributed event.
     * @throws {RoundNotFound} if the round is not found.
     * @throws {ApplicationNotFound} if the application is not found.
     * @returns An array of changesets with the following:
     *     1. UpdateApplication: Updates the application with the transaction hash.
     *     2. IncrementRoundTotalDistributed: Increments the total distributed amount for a round.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, applicationRepository, logger } = this.dependencies;
        const strategyAddress = getAddress(this.event.srcAddress);
        const amount = BigInt(this.event.params.amount);

        logger?.debug("Starting funds distribution handling", {
            className: "BaseFundsDistributedHandler",
            methodName: "handle",
            strategyAddress,
            amount: amount.toString(),
            recipientId: this.event.params.recipientId,
            chainId: this.chainId,
        });

        logger?.debug("Fetching round by strategy address", {
            className: "BaseFundsDistributedHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        logger?.debug("Round found", {
            className: "BaseFundsDistributedHandler",
            methodName: "handle",
            roundId: round.id,
            strategyAddress,
        });

        const roundId = round.id;
        const anchorAddress = getAddress(this.event.params.recipientId);

        logger?.debug("Fetching application by anchor address", {
            className: "BaseFundsDistributedHandler",
            methodName: "handle",
            roundId,
            anchorAddress,
            chainId: this.chainId,
        });

        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            roundId,
            anchorAddress,
        );

        logger?.debug("Creating distribution changesets", {
            className: "BaseFundsDistributedHandler",
            methodName: "handle",
            roundId,
            applicationId: application.id,
            amount: amount.toString(),
            transactionHash: this.event.transactionFields.hash,
        });

        const changes: Changeset[] = [
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
                    amount,
                },
            },
        ];

        logger?.info("Funds distribution completed", {
            className: "BaseFundsDistributedHandler",
            methodName: "handle",
            roundId,
            applicationId: application.id,
            amount: amount.toString(),
            changeCount: changes.length,
        });

        return changes;
    }
}
