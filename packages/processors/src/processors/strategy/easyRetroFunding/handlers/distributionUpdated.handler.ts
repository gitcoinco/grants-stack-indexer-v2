import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import {
    IEventHandler,
    MetadataNotFound,
    MetadataParsingFailed,
    ProcessorDependencies,
} from "../../../../internal.js";
import {
    SimpleMatchingDistribution,
    SimpleMatchingDistributionSchema,
} from "../../../../schemas/index.js";

type Dependencies = Pick<ProcessorDependencies, "metadataProvider" | "logger">;

/**
 * ERFDistributionUpdatedHandler: Processes 'DistributionUpdated' events
 *
 * - Decodes the updated distribution metadata
 * - Creates a changeset to update the round with the new distribution
 *
 * @dev:
 * - Strategy handlers that want to handle the DistributionUpdated event should create an instance of this class corresponding to the event.
 *
 */

export class ERFDistributionUpdatedHandler
    implements IEventHandler<"Strategy", "DistributionUpdated">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "DistributionUpdated">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { logger, metadataProvider } = this.dependencies;
        const [_, pointer] = this.event.params.metadata;

        const strategyAddress = getAddress(this.event.srcAddress);
        const rawDistribution = await metadataProvider.getMetadata<
            SimpleMatchingDistribution | undefined
        >(pointer);

        if (!rawDistribution) {
            logger.warn(`No matching distribution found for pointer: ${pointer}`);

            throw new MetadataNotFound(`No matching distribution found for pointer: ${pointer}`);
        }

        const distribution = SimpleMatchingDistributionSchema.safeParse(rawDistribution);

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
                        matchingDistribution: distribution.data,
                    },
                },
            },
        ];
    }
}
