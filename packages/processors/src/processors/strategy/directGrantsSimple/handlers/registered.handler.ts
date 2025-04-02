import { getAddress } from "viem";

import { Changeset, NewApplication } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";
import { decodeDGApplicationData } from "../../helpers/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "roundRepository" | "projectRepository" | "metadataProvider" | "logger"
>;

/**
 * Handles the Registered event for the Donation Voting Merkle Distribution Direct Transfer strategy.
 *
 * This handler performs the following core actions when a project registers for a round:
 * - Validates that both the project and round exist
 * - Decodes the application data from the event
 * - Retrieves the application metadata
 * - Creates a new application record with PENDING status
 * - Links the application to both the project and round
 */

export class DGSimpleRegisteredHandler
    implements IEventHandler<"Strategy", "RegisteredWithSender">
{
    constructor(
        readonly event: ProcessorEvent<"Strategy", "RegisteredWithSender">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing DGSimpleRegisteredHandler", {
            className: "DGSimpleRegisteredHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
            transactionHash: this.event.transactionFields.hash,
        });
    }

    /**
     * Handles the RegisteredWithSender event for the Direct Grants Simple strategy.
     * @returns The changeset with an InsertApplication operation.
     * @throws ProjectNotFound if the project is not found.
     * @throws RoundNotFound if the round is not found.
     */
    async handle(): Promise<Changeset[]> {
        const { projectRepository, roundRepository, metadataProvider, logger } = this.dependencies;
        const { data: encodedData, recipientId, sender } = this.event.params;
        const { blockNumber, blockTimestamp } = this.event;

        logger?.debug("Starting registration handling", {
            className: "DGSimpleRegisteredHandler",
            methodName: "handle",
            recipientId,
            sender,
            blockNumber,
        });

        const anchorAddress = getAddress(recipientId);
        logger?.debug("Fetching project by anchor", {
            className: "DGSimpleRegisteredHandler",
            methodName: "handle",
            anchorAddress,
            chainId: this.chainId,
        });

        const project = await projectRepository.getProjectByAnchorOrThrow(
            this.chainId,
            anchorAddress,
        );

        const strategyAddress = getAddress(this.event.srcAddress);
        logger?.debug("Fetching round by strategy address", {
            className: "DGSimpleRegisteredHandler",
            methodName: "handle",
            strategyAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        logger?.debug("Decoding application data", {
            className: "DGSimpleRegisteredHandler",
            methodName: "handle",
            encodedDataLength: encodedData.length,
        });

        const values = decodeDGApplicationData(encodedData);
        const id = recipientId;

        logger?.debug("Fetching application metadata", {
            className: "DGSimpleRegisteredHandler",
            methodName: "handle",
            metadataPointer: values.metadata.pointer,
            applicationId: id,
        });

        const metadata = await metadataProvider.getMetadata(values.metadata.pointer);

        logger?.debug("Creating application record", {
            className: "DGSimpleRegisteredHandler",
            methodName: "handle",
            applicationId: id,
            projectId: project.id,
            roundId: round.id,
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

        logger?.info("Registration processing completed", {
            className: "DGSimpleRegisteredHandler",
            methodName: "handle",
            applicationId: id,
            roundId: round.id,
            projectId: project.id,
            status: "PENDING",
            blockNumber,
        });

        return [
            {
                type: "InsertApplication" as const,
                args: application,
            },
        ];
    }
}
