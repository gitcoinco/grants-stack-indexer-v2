import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, getTokenOrThrow, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getTokenAmountInUsd, getUsdInTokenAmount } from "../../../../helpers/index.js";
import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "roundRepository" | "applicationRepository" | "pricingProvider"
>;

/**
 * Handler for processing AllocatedWithToken events from the DirectGrantsLite strategy.
 *
 * When a round operator allocates funds to a recipient, this handler:
 * 1. Retrieves the round and application based on the strategy address and recipient
 * 2. Converts the allocated token amount to USD value
 * 3. Calculates the equivalent amount in the round's match token
 * 4. Updates the application with the allocation details
 */

export class DGLiteAllocatedHandler implements IEventHandler<"Strategy", "AllocatedWithToken"> {
    constructor(
        readonly event: ProcessorEvent<"Strategy", "AllocatedWithToken">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    /**
     * Handles the AllocatedWithToken event for the Direct Grants Lite strategy.
     * @returns The changeset with an InsertApplicationPayout and IncrementRoundTotalDistributed operation.
     * @throws RoundNotFound if the round is not found.
     * @throws ApplicationNotFound if the application is not found.
     * @throws TokenNotFound if the token is not found.
     * @throws TokenPriceNotFound if the token price is not found.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, applicationRepository } = this.dependencies;
        const { srcAddress } = this.event;
        const { recipientId: _recipientId, amount: strAmount, token: _token } = this.event.params;

        const amount = BigInt(strAmount);

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            getAddress(srcAddress),
        );

        const recipientId = getAddress(_recipientId);
        const tokenAddress = getAddress(_token);
        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            round.id,
            recipientId,
        );

        const token = getTokenOrThrow(this.chainId, tokenAddress);
        const matchToken = getTokenOrThrow(this.chainId, round.matchTokenAddress);

        let amountInUsd = "0";
        let amountInRoundMatchToken = 0n;

        if (amount > 0) {
            const { amountInUsd: amountInUsdString } = await getTokenAmountInUsd(
                this.dependencies.pricingProvider,
                token,
                amount,
                this.event.blockTimestamp,
            );
            amountInUsd = amountInUsdString;

            amountInRoundMatchToken =
                matchToken.address === token.address
                    ? amount
                    : (
                          await getUsdInTokenAmount(
                              this.dependencies.pricingProvider,
                              matchToken,
                              amountInUsd,
                              this.event.blockTimestamp,
                          )
                      ).amount;
        }

        const timestamp = this.event.blockTimestamp;

        return [
            {
                type: "InsertApplicationPayout",
                args: {
                    applicationPayout: {
                        amount,
                        applicationId: application.id,
                        roundId: round.id,
                        chainId: this.chainId,
                        tokenAddress,
                        amountInRoundMatchToken,
                        amountInUsd,
                        transactionHash: this.event.transactionFields.hash,
                        sender: getAddress(this.event.params.sender),
                        timestamp: new Date(timestamp),
                    },
                },
            },
            {
                type: "IncrementRoundTotalDistributed",
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    amount: amountInRoundMatchToken,
                },
            },
        ];
    }
}
