import { parseUnits } from "viem";

import type { Changeset } from "@grants-stack-indexer/repository";
import type { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";
import { getToken } from "@grants-stack-indexer/shared";

import type { IEventHandler, ProcessorDependencies } from "../../../internal.js";
import { getTokenAmountInUsd } from "../../../helpers/index.js";
import { RoundMetadataSchema } from "../../../schemas/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "metadataProvider" | "roundRepository" | "pricingProvider"
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
    ) {}
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const [_protocol, metadataPointer] = this.event.params.metadata;
        const { metadataProvider, pricingProvider, roundRepository } = this.dependencies;

        const metadata = await metadataProvider.getMetadata<{
            round?: unknown;
            application?: unknown;
        }>(metadataPointer);

        const round = await roundRepository.getRoundByIdOrThrow(
            this.chainId,
            this.event.params.poolId.toString(),
        );

        let matchAmount = round.matchAmount;
        let matchAmountInUsd = round.matchAmountInUsd;

        const parsedRoundMetadata = RoundMetadataSchema.safeParse(metadata?.round);
        const token = getToken(this.chainId, round.matchTokenAddress);

        if (parsedRoundMetadata.success && token) {
            matchAmount = parseUnits(
                parsedRoundMetadata.data.quadraticFundingConfig.matchingFundsAvailable.toString(),
                token.decimals,
            );
            matchAmountInUsd = (
                await getTokenAmountInUsd(
                    pricingProvider,
                    token,
                    matchAmount,
                    this.event.blockTimestamp,
                )
            ).amountInUsd;
        }

        return [
            {
                type: "UpdateRound",
                args: {
                    chainId: this.chainId,
                    roundId: this.event.params.poolId.toString(),
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
