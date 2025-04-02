import { getAddress } from "viem";

import { Changeset, NewApplication } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";
import { decodeDVMDExtendedApplicationData } from "../../helpers/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "roundRepository" | "projectRepository" | "metadataProvider" | "logger"
>;

/**
 * Handles the Registered event for the Easy Retro Funding strategy.
 *
 * This handler performs the following core actions when a project registers for a round:
 * - Validates that both the project and round exist
 * - Decodes the application data from the event
 * - Retrieves the application metadata
 * - Creates a new application record with PENDING status
 * - Links the application to both the project and round
 */
export class ERFRegisteredHandler implements IEventHandler<"Strategy", "RegisteredWithSender"> {
    constructor(
        readonly event: ProcessorEvent<"Strategy", "RegisteredWithSender">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    /**
     * Handles the RegisteredWithSender event for the Easy Retro Funding strategy.
     * @returns The changeset with an InsertApplication operation.
     * @throws ProjectNotFound if the project is not found.
     * @throws RoundNotFound if the round is not found.
     */
    async handle(): Promise<Changeset[]> {
        const { projectRepository, roundRepository, metadataProvider, logger } = this.dependencies;
        const { data: encodedData, recipientId, sender } = this.event.params;
        const { blockNumber, blockTimestamp } = this.event;

        logger.debug("Starting registration handling", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            chainId: this.chainId,
            eventDetails: {
                blockNumber,
                logIndex: this.event.logIndex,
                recipientId,
                sender,
                encodedDataLength: encodedData.length,
            },
        });

        const anchorAddress = getAddress(recipientId);
        logger.debug("Fetching project by anchor", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            chainId: this.chainId,
            anchorAddress,
        });

        const project = await projectRepository.getProjectByAnchorOrThrow(
            this.chainId,
            anchorAddress,
        );

        logger.debug("Project found", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            projectId: project.id,
        });

        const strategyAddress = getAddress(this.event.srcAddress);
        logger.debug("Fetching round by strategy", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            strategyAddress,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        logger.debug("Round found", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            roundId: round.id,
        });

        logger.debug("Decoding application data", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            encodedDataLength: encodedData.length,
        });

        const values = decodeDVMDExtendedApplicationData(encodedData);
        const id = (Number(values.recipientsCounter) - 1).toString();

        logger.debug("Application data decoded", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            applicationId: id,
            metadataPointer: values.metadata.pointer,
        });

        logger.debug("Fetching metadata", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            metadataPointer: values.metadata.pointer,
        });

        const metadata = await metadataProvider.getMetadata(values.metadata.pointer);

        logger.debug("Metadata retrieved", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            metadataFound: metadata !== null,
        });

        const application: NewApplication = {
            chainId: this.chainId,
            id: id,
            projectId: project.id,
            anchorAddress,
            roundId: round.id,
            status: "PENDING",
            metadataCid: values.metadata.pointer,
            metadata: metadata ?? null,
            createdAtBlock: BigInt(blockNumber),
            createdByAddress: getAddress(sender),
            statusUpdatedAtBlock: BigInt(blockNumber),
            statusSnapshots: [
                {
                    status: "PENDING",
                    updatedAtBlock: blockNumber.toString(),
                    updatedAt: new Date(blockTimestamp),
                },
            ],
            distributionTransaction: null,
            totalAmountDonatedInUsd: "0",
            totalDonationsCount: 0,
            uniqueDonorsCount: 0,
            timestamp: new Date(blockTimestamp),
            tags: ["allo-v2"],
        };

        logger.info("Registration handling completed", {
            className: ERFRegisteredHandler.name,
            methodName: "handle",
            applicationDetails: {
                id,
                projectId: project.id,
                roundId: round.id,
                anchorAddress,
                createdByAddress: getAddress(sender),
                metadataCid: values.metadata.pointer,
                blockNumber: blockNumber.toString(),
                timestamp: new Date(blockTimestamp).toISOString(),
            },
        });

        return [
            {
                type: "InsertApplication",
                args: application,
            },
        ];
    }
}
