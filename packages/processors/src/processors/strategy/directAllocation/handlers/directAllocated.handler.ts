import { getAddress } from "viem";

import { Changeset, Donation } from "@grants-stack-indexer/repository";
import { ChainId, getTokenOrThrow, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getTokenAmountInUsd } from "../../../../helpers/index.js";
import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";
import { getDonationId } from "../../helpers/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "projectRepository" | "roundRepository" | "pricingProvider" | "logger"
>;

/**
 * Handles the DirectAllocated event for the Direct Allocation strategy.
 *
 * This handler processes direct allocations of funds to a project by:
 * - Validating that both the round and project exist
 * - Retrieving token price data to calculate USD amounts
 * - Creating a new donation record with the allocated amount
 *
 * Unlike other allocation handlers, this one does not require an application
 * since funds are allocated directly to projects.
 */
export class DirectAllocatedHandler implements IEventHandler<"Strategy", "DirectAllocated"> {
    constructor(
        readonly event: ProcessorEvent<"Strategy", "DirectAllocated">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing DirectAllocatedHandler", {
            className: "DirectAllocatedHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
            transactionHash: this.event.transactionFields.hash,
        });
    }

    /**
     * Handles the DirectAllocated event for the Direct Allocation strategy.
     * @returns {Changeset[]} The changeset containing an InsertDonation change
     * @throws {ProjectNotFound} if the project does not exist
     * @throws {RoundNotFound} if the round does not exist
     * @throws {UnknownToken} if the token does not exist
     * @throws {TokenPriceNotFoundError} if the token price is not found
     */
    async handle(): Promise<Changeset[]> {
        const { projectRepository, roundRepository, pricingProvider, logger } = this.dependencies;
        const strategyAddress = getAddress(this.event.srcAddress);

        logger?.debug("Starting direct allocation handling", {
            className: "DirectAllocatedHandler",
            methodName: "handle",
            strategyAddress,
            profileId: this.event.params.profileId,
            amount: this.event.params.amount,
            token: this.event.params.token,
        });

        logger?.debug("Fetching round by strategy address", {
            className: "DirectAllocatedHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        logger?.debug("Fetching project details", {
            className: "DirectAllocatedHandler",
            methodName: "handle",
            chainId: this.chainId,
            profileId: this.event.params.profileId,
        });

        const project = await projectRepository.getProjectByIdOrThrow(
            this.chainId,
            this.event.params.profileId,
        );

        const donationId = getDonationId(this.event.blockNumber, this.event.logIndex);
        const amount = BigInt(this.event.params.amount);
        const token = getTokenOrThrow(this.chainId, this.event.params.token);
        const sender = getAddress(this.event.params.sender);

        logger?.debug("Calculating USD amount for donation", {
            className: "DirectAllocatedHandler",
            methodName: "handle",
            donationId,
            amount: amount.toString(),
            token: token,
            timestamp: this.event.blockTimestamp,
        });

        const { amountInUsd } = await getTokenAmountInUsd(
            pricingProvider,
            token,
            amount,
            this.event.blockTimestamp,
        );

        logger?.debug("Creating donation record", {
            className: "DirectAllocatedHandler",
            methodName: "handle",
            donationId,
            roundId: round.id,
            projectId: project.id,
            amountInUsd,
        });

        const donation: Donation = {
            id: donationId,
            chainId: this.chainId,
            roundId: round.id,
            applicationId: null,
            donorAddress: sender,
            recipientAddress: getAddress(this.event.params.profileOwner),
            projectId: project.id,
            transactionHash: this.event.transactionFields.hash,
            blockNumber: BigInt(this.event.blockNumber),
            tokenAddress: token.address,
            amount: amount,
            amountInUsd,
            amountInRoundMatchToken: 0n,
            timestamp: new Date(this.event.blockTimestamp),
        };

        const changes = [
            {
                type: "InsertDonation" as const,
                args: { donation },
            },
            {
                type: "IncrementRoundDonationStats" as const,
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    amountInUsd,
                },
            },
        ];

        logger?.info("Direct allocation processing completed", {
            className: "DirectAllocatedHandler",
            methodName: "handle",
            donationId,
            roundId: round.id,
            projectId: project.id,
            amountInUsd,
            changeCount: changes.length,
        });

        return changes;
    }
}
