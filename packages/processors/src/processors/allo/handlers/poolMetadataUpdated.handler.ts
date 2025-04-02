import { parseUnits } from "viem";

import type { Changeset } from "@grants-stack-indexer/repository";
import type { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";
import { getToken } from "@grants-stack-indexer/shared";

import type { IEventHandler, ProcessorDependencies } from "../../../internal.js";
import { getTokenAmountInUsd } from "../../../helpers/index.js";
import { RoundMetadataSchema } from "../../../schemas/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "metadataProvider" | "roundRepository" | "pricingProvider" | "logger"
>;

/**
 * Handles the PoolMetadataUpdated event for the Allo protocol.
 *
 * This handler performs the following core actions when a pool metadata is updated:
 * - Fetches the round metadata from the metadata provider.
 * - Returns the changeset to update the round with the new metadata.
 */
export class PoolMetadataUpdatedHandler implements IEventHandler<"Allo", "PoolMetadataUpdated"> {
    constructor(
        readonly event: ProcessorEvent<"Allo", "PoolMetadataUpdated">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing PoolMetadataUpdatedHandler", {
            className: "PoolMetadataUpdatedHandler",
            chainId: this.chainId,
            poolId: this.event.params.poolId.toString(),
            blockNumber: this.event.blockNumber,
        });
    }

    async handle(): Promise<Changeset[]> {
        const { metadataProvider, pricingProvider, roundRepository, logger } = this.dependencies;
        const [_protocol, metadataPointer] = this.event.params.metadata;
        const poolId = this.event.params.poolId.toString();

        logger?.debug("Starting pool metadata update handling", {
            className: "PoolMetadataUpdatedHandler",
            methodName: "handle",
            poolId,
            metadataPointer,
        });

        logger?.debug("Fetching metadata", {
            className: "PoolMetadataUpdatedHandler",
            methodName: "handle",
            poolId,
            metadataPointer,
        });

        const metadata = await metadataProvider.getMetadata<{
            round?: unknown;
            application?: unknown;
        }>(metadataPointer);

        logger?.debug("Fetching round data", {
            className: "PoolMetadataUpdatedHandler",
            methodName: "handle",
            poolId,
            hasRoundMetadata: !!metadata?.round,
            hasApplicationMetadata: !!metadata?.application,
        });

        const round = await roundRepository.getRoundByIdOrThrow(this.chainId, poolId);

        let matchAmount = round.matchAmount;
        let matchAmountInUsd = round.matchAmountInUsd;

        logger?.debug("Parsing round metadata", {
            className: "PoolMetadataUpdatedHandler",
            methodName: "handle",
            poolId,
            currentMatchAmount: matchAmount.toString(),
        });

        const parsedRoundMetadata = RoundMetadataSchema.safeParse(metadata?.round);
        const token = getToken(this.chainId, round.matchTokenAddress);

        logger?.debug("Token and metadata validation", {
            className: "PoolMetadataUpdatedHandler",
            methodName: "handle",
            poolId,
            hasToken: !!token,
            metadataParseSuccess: parsedRoundMetadata.success,
            tokenAddress: round.matchTokenAddress,
        });

        if (parsedRoundMetadata.success && token) {
            logger?.debug("Updating match amounts", {
                className: "PoolMetadataUpdatedHandler",
                methodName: "handle",
                poolId,
                matchingFundsAvailable:
                    parsedRoundMetadata.data.quadraticFundingConfig.matchingFundsAvailable,
                tokenDecimals: token.decimals,
            });

            matchAmount = parseUnits(
                parsedRoundMetadata.data.quadraticFundingConfig.matchingFundsAvailable.toString(),
                token.decimals,
            );

            logger?.debug("Calculating USD amount", {
                className: "PoolMetadataUpdatedHandler",
                methodName: "handle",
                poolId,
                newMatchAmount: matchAmount.toString(),
            });

            matchAmountInUsd = (
                await getTokenAmountInUsd(
                    pricingProvider,
                    token,
                    matchAmount,
                    this.event.blockTimestamp,
                )
            ).amountInUsd;

            logger?.debug("Match amounts updated", {
                className: "PoolMetadataUpdatedHandler",
                methodName: "handle",
                poolId,
                matchAmount: matchAmount.toString(),
                matchAmountInUsd,
            });
        }

        logger?.info("Pool metadata update completed", {
            className: "PoolMetadataUpdatedHandler",
            methodName: "handle",
            poolId,
            metadataPointer,
            matchAmount: matchAmount.toString(),
            matchAmountInUsd,
        });

        return [
            {
                type: "UpdateRound",
                args: {
                    chainId: this.chainId,
                    roundId: poolId,
                    round: {
                        matchAmount,
                        matchAmountInUsd,
                        applicationMetadataCid: metadataPointer,
                        applicationMetadata: metadata?.application ?? {},
                        roundMetadataCid: metadataPointer,
                        roundMetadata: metadata?.round ?? {},
                    },
                },
            },
        ];
    }
}
