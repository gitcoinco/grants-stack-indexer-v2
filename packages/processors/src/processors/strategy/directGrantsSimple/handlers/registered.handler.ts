import { getAddress } from "viem";

import { Changeset, NewApplication } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../../internal.js";
import { decodeDGApplicationData } from "../../helpers/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "roundRepository" | "projectRepository" | "metadataProvider"
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
    ) {}

    /**
     * Handles the RegisteredWithSender event for the Direct Grants Simple strategy.
     * @returns The changeset with an InsertApplication operation.
     * @throws ProjectNotFound if the project is not found.
     * @throws RoundNotFound if the round is not found.
     */
    async handle(): Promise<Changeset[]> {
        const { projectRepository, roundRepository, metadataProvider } = this.dependencies;
        const { data: encodedData, recipientId, sender } = this.event.params;
        const { blockNumber, blockTimestamp } = this.event;

        const anchorAddress = getAddress(recipientId);
        const project = await projectRepository.getProjectByAnchorOrThrow(
            this.chainId,
            anchorAddress,
        );

        const strategyAddress = getAddress(this.event.srcAddress);
        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            strategyAddress,
        );

        const values = decodeDGApplicationData(encodedData);
        const id = recipientId;

        const metadata = await metadataProvider.getMetadata(values.metadata.pointer);

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
                    updatedAt: new Date(blockTimestamp * 1000), // timestamp is in seconds, convert to ms
                },
            ],
            distributionTransaction: null,
            totalAmountDonatedInUsd: 0,
            totalDonationsCount: 0,
            uniqueDonorsCount: 0,
            tags: ["allo-v2"],
        };

        return [
            {
                type: "InsertApplication",
                args: application,
            },
        ];
    }
}
