import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import {
    IEventHandler,
    MetadataNotFound,
    MetadataParsingFailed,
    ProcessorDependencies,
} from "../../../internal.js";
import { MatchingDistribution, MatchingDistributionSchema } from "../../../schemas/index.js";

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
    implements
        IEventHandler<"Strategy", "DistributionUpdated" | "DistributionUpdatedWithMerkleRoot">
{
    constructor(
        readonly event: ProcessorEvent<
            "Strategy",
            "DistributionUpdated" | "DistributionUpdatedWithMerkleRoot"
        >,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing BaseDistributionUpdatedHandler", {
            className: "BaseDistributionUpdatedHandler",
            chainId: this.chainId,
            eventName: this.event.eventName,
            blockNumber: this.event.blockNumber,
            strategyAddress: this.event.srcAddress,
        });
    }

    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { logger, metadataProvider } = this.dependencies;
        const [_, pointer] = this.event.params.metadata;
        const strategyAddress = getAddress(this.event.srcAddress);

        logger?.debug("Starting distribution update handling", {
            className: "BaseDistributionUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            metadataPointer: pointer,
            chainId: this.chainId,
        });

        logger?.debug("Fetching distribution metadata", {
            className: "BaseDistributionUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            metadataPointer: pointer,
        });

        const rawDistribution = await metadataProvider.getMetadata<
            MatchingDistribution | undefined
        >(pointer);

        if (!rawDistribution) {
            logger?.warn("Distribution metadata not found", {
                className: "BaseDistributionUpdatedHandler",
                methodName: "handle",
                strategyAddress,
                metadataPointer: pointer,
                chainId: this.chainId,
            });

            throw new MetadataNotFound(`No matching distribution found for pointer: ${pointer}`);
        }

        logger?.debug("Parsing distribution metadata", {
            className: "BaseDistributionUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            metadataPointer: pointer,
            hasRawDistribution: true,
        });

        const distribution = MatchingDistributionSchema.safeParse(rawDistribution);

        if (!distribution.success) {
            logger?.warn("Distribution metadata parsing failed", {
                className: "BaseDistributionUpdatedHandler",
                methodName: "handle",
                strategyAddress,
                metadataPointer: pointer,
                errorMessage: distribution.error.message,
                errors: distribution.error.errors,
            });

            throw new MetadataParsingFailed(
                `Failed to parse matching distribution: ${distribution.error.message}`,
            );
        }

        logger?.debug("Creating update changeset", {
            className: "BaseDistributionUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            transactionHash: this.event.transactionFields.hash,
            distributionSize: distribution.data.matchingDistribution.length,
        });

        const changes: Changeset[] = [
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

        logger?.info("Distribution update completed", {
            className: "BaseDistributionUpdatedHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
            changeCount: changes.length,
            distributionSize: distribution.data.matchingDistribution.length,
        });

        return changes;
    }
}
