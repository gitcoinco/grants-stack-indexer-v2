import { Address, getAddress } from "viem";

import { Application, Changeset, Round } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import {
    ApplicationNotFound,
    IEventHandler,
    ProcessorDependencies,
    RoundNotFound,
} from "../../internal.js";

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
        const strategyAddress = getAddress(this.event.srcAddress);
        const round = await this.getRoundOrThrow(strategyAddress);

        const roundId = round.id;
        const anchorAddress = getAddress(this.event.params.recipientId);
        const application = await this.getApplicationOrThrow(roundId, anchorAddress);

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

    /**
     * Retrieves a round by its strategy address.
     * @param {Address} strategyAddress - The address of the strategy.
     * @returns {Promise<Round>} The round found.
     * @throws {RoundNotFound} if the round does not exist.
     */
    private async getRoundOrThrow(strategyAddress: Address): Promise<Round> {
        const { roundRepository } = this.dependencies;
        const round = await roundRepository.getRoundByStrategyAddress(
            this.chainId,
            strategyAddress,
        );

        if (!round) {
            throw new RoundNotFound(this.chainId, strategyAddress);
        }

        return round;
    }

    /**
     * Retrieves an application by its round ID and recipient address.
     * @param {string} roundId - The ID of the round.
     * @param {Address} recipientId - The address of the recipient.
     * @returns {Promise<Application>} The application found.
     * @throws {ApplicationNotFound} if the application does not exist.
     */
    private async getApplicationOrThrow(
        roundId: string,
        anchorAddress: Address,
    ): Promise<Application> {
        const { applicationRepository } = this.dependencies;
        const application = await applicationRepository.getApplicationByAnchorAddress(
            this.chainId,
            roundId,
            anchorAddress,
        );

        if (!application) {
            throw new ApplicationNotFound(this.chainId, roundId, anchorAddress);
        }

        return application;
    }
}
