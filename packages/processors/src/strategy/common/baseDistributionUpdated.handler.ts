import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import {
    IEventHandler,
    MetadataNotFound,
    MetadataParsingFailed,
    ProcessorDependencies,
} from "../../internal.js";
import { MatchingDistribution, MatchingDistributionSchema } from "../../schemas/index.js";

type Dependencies = Pick<ProcessorDependencies, "metadataProvider" | "logger">;

/**
 * BaseDistributionUpdatedHandler: Processes 'DistributionUpdated' events
 *
 * - Decodes the updated distribution metadata
 * - Creates a changeset to update the round with the new distribution
 * - Serves as a base class as all strategies share the same logic for this event.
 *
 * @dev:
 * - Strategy handlers that want to handle the DistributionUpdated event should create an instance of this class corresponding to the event.
 *
 */

export class BaseDistributionUpdatedHandler
    implements IEventHandler<"Strategy", "DistributionUpdated">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "DistributionUpdated">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    async handle(): Promise<Changeset[]> {
        const { logger, metadataProvider } = this.dependencies;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [_, pointer] = this.event.params.metadata;

        const strategyAddress = getAddress(this.event.srcAddress);
        const rawDistribution = await metadataProvider.getMetadata<
            MatchingDistribution | undefined
        >(pointer);

        if (!rawDistribution) {
            logger.warn(`No matching distribution found for pointer: ${pointer}`);

            throw new MetadataNotFound(`No matching distribution found for pointer: ${pointer}`);
        }

        const distribution = MatchingDistributionSchema.safeParse(rawDistribution);

        if (!distribution.success) {
            logger.warn(`Failed to parse matching distribution: ${distribution.error.message}`);

            throw new MetadataParsingFailed(
                `Failed to parse matching distribution: ${distribution.error.message}`,
            );
        }

        return [
            {
                type: "UpdateRoundByStrategyAddress",
                args: {
                    chainId: this.chainId,
                    strategyAddress,
                    round: {
                        readyForPayoutTransaction: this.event.transactionFields.hash,
                        matchingDistribution: distribution.data.matchingDistribution,
                    },
                },
            },
        ];
    }
}
