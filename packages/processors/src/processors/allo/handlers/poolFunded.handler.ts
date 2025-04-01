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
    ) {
        this.dependencies.logger?.debug("Initializing PoolFundedHandler", {
            className: "PoolFundedHandler",
            chainId: this.chainId,
            poolId: this.event.params.poolId.toString(),
            blockNumber: this.event.blockNumber,
        });
    }
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, pricingProvider, logger } = this.dependencies;
        const poolId = this.event.params.poolId.toString();
        const fundedAmount = BigInt(this.event.params.amount);

        logger?.debug("Starting pool funding handling", {
            className: "PoolFundedHandler",
            methodName: "handle",
            poolId,
            fundedAmount: fundedAmount.toString(),
            blockNumber: this.event.blockNumber,
        });

        logger?.debug("Fetching round data", {
            className: "PoolFundedHandler",
            methodName: "handle",
            poolId,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByIdOrThrow(this.chainId, poolId);

        logger?.debug("Getting token information", {
            className: "PoolFundedHandler",
            methodName: "handle",
            poolId,
            matchTokenAddress: round.matchTokenAddress,
        });

        const token = getToken(this.chainId, round.matchTokenAddress);

        if (!token) {
            logger?.error("Unknown token encountered", {
                className: "PoolFundedHandler",
                methodName: "handle",
                poolId,
                tokenAddress: round.matchTokenAddress,
                chainId: this.chainId,
            });
            throw new UnknownToken(round.matchTokenAddress, this.chainId);
        }

        logger?.debug("Calculating USD amount", {
            className: "PoolFundedHandler",
            methodName: "handle",
            poolId,
            tokenAddress: token.address,
            amount: fundedAmount.toString(),
            timestamp: this.event.blockTimestamp,
        });

        const { amountInUsd } = await getTokenAmountInUsd(
            pricingProvider,
            token,
            fundedAmount,
            this.event.blockTimestamp,
        );

        logger?.info("Pool funding processed successfully", {
            className: "PoolFundedHandler",
            methodName: "handle",
            poolId,
            fundedAmount: fundedAmount.toString(),
            amountInUsd,
            tokenAddress: token.address,
        });

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
