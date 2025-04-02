import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, getTokenOrThrow, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getTokenAmountInUsd, getUsdInTokenAmount } from "../../../../helpers/index.js";
import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "roundRepository" | "applicationRepository" | "pricingProvider" | "logger"
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
    ) {
        this.dependencies.logger?.debug("Initializing DGLiteAllocatedHandler", {
            className: "DGLiteAllocatedHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
            transactionHash: this.event.transactionFields.hash,
        });
    }

    /**
     * Handles the AllocatedWithToken event for the Direct Grants Lite strategy.
     * @returns The changeset with an InsertApplicationPayout and IncrementRoundTotalDistributed operation.
     * @throws RoundNotFound if the round is not found.
     * @throws ApplicationNotFound if the application is not found.
     * @throws TokenNotFound if the token is not found.
     * @throws TokenPriceNotFound if the token price is not found.
     */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, applicationRepository, pricingProvider, logger } =
            this.dependencies;
        const { srcAddress } = this.event;
        const { recipientId: _recipientId, amount: strAmount, token: _token } = this.event.params;

        logger?.debug("Starting allocation handling", {
            className: "DGLiteAllocatedHandler",
            methodName: "handle",
            strategyAddress: srcAddress,
            recipientId: _recipientId,
            amount: strAmount,
            token: _token,
        });

        const amount = BigInt(strAmount);

        logger?.debug("Fetching round by strategy address", {
            className: "DGLiteAllocatedHandler",
            methodName: "handle",
            strategyAddress: srcAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            getAddress(srcAddress),
        );

        const recipientId = getAddress(_recipientId);
        const tokenAddress = getAddress(_token);

        logger?.debug("Fetching application details", {
            className: "DGLiteAllocatedHandler",
            methodName: "handle",
            roundId: round.id,
            recipientId,
            chainId: this.chainId,
        });

        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            round.id,
            recipientId,
        );

        const token = getTokenOrThrow(this.chainId, tokenAddress);
        const matchToken = getTokenOrThrow(this.chainId, round.matchTokenAddress);

        logger?.debug("Processing token amounts", {
            className: "DGLiteAllocatedHandler",
            methodName: "handle",
            token: token,
            amount: amount.toString(),
        });

        let amountInUsd = "0";
        let amountInRoundMatchToken = 0n;

        if (amount > 0) {
            logger?.debug("Converting amount to USD", {
                className: "DGLiteAllocatedHandler",
                methodName: "handle",
                amount: amount.toString(),
                token: token,
                timestamp: this.event.blockTimestamp,
            });

            const { amountInUsd: amountInUsdString } = await getTokenAmountInUsd(
                pricingProvider,
                token,
                amount,
                this.event.blockTimestamp,
            );
            amountInUsd = amountInUsdString;

            logger?.debug("Calculating match token amount", {
                className: "DGLiteAllocatedHandler",
                methodName: "handle",
                amountInUsd,
                matchToken: matchToken,
                usingDirectConversion: matchToken.address === token.address,
            });

            amountInRoundMatchToken =
                matchToken.address === token.address
                    ? amount
                    : (
                          await getUsdInTokenAmount(
                              pricingProvider,
                              matchToken,
                              amountInUsd,
                              this.event.blockTimestamp,
                          )
                      ).amount;
        }

        const changes = [
            {
                type: "InsertApplicationPayout" as const,
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
                        timestamp: new Date(this.event.blockTimestamp),
                    },
                },
            },
            {
                type: "IncrementRoundTotalDistributed" as const,
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    amount: amountInRoundMatchToken,
                },
            },
        ];

        logger?.info("Allocation processing completed", {
            className: "DGLiteAllocatedHandler",
            methodName: "handle",
            applicationId: application.id,
            roundId: round.id,
            amount: amount.toString(),
            amountInUsd,
            amountInRoundMatchToken: amountInRoundMatchToken.toString(),
            changeCount: changes.length,
        });

        return changes;
    }
}
