import { Changeset, ProjectType } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";
import { ProjectMetadata, ProjectMetadataSchema } from "../../../schemas/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "projectRepository" | "evmProvider" | "metadataProvider" | "logger"
>;

/**
 * Handles the ProfileMetadataUpdated event for the Registry contract from Allo protocol.
 *
 * This handler performs the following steps:
 * - Fetches the metadata for the profile from the metadata provider
 * - Parses the metadata to extract the project type
 * - Returns the changeset to update the project with the metadata
 */
export class ProfileMetadataUpdatedHandler
    implements IEventHandler<"Registry", "ProfileMetadataUpdated">
{
    constructor(
        readonly event: ProcessorEvent<"Registry", "ProfileMetadataUpdated">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {}
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { metadataProvider } = this.dependencies;

        const metadataCid = this.event.params.metadata[1];
        const metadata = await metadataProvider.getMetadata(metadataCid);
        const parsedMetadata = ProjectMetadataSchema.safeParse(metadata);

        if (!parsedMetadata.success) {
            return [
                {
                    type: "UpdateProject",
                    args: {
                        chainId: this.chainId,
                        projectId: this.event.params.profileId,
                        project: {
                            metadataCid: metadataCid,
                            metadata: null,
                            projectType: "canonical",
                        },
                    },
                },
            ];
        }

        const projectType = this.getProjectTypeFromMetadata(parsedMetadata.data);

        return [
            {
                type: "UpdateProject",
                args: {
                    chainId: this.chainId,
                    projectId: this.event.params.profileId,
                    project: {
                        metadataCid: metadataCid,
                        metadata: metadata,
                        projectType,
                    },
                },
            },
        ];
    }
    private getProjectTypeFromMetadata(metadata: ProjectMetadata): ProjectType {
        // if the metadata contains a canonical reference, it's a linked project
        if ("canonical" in metadata) {
            return "linked";
        }

        return "canonical";
    }
}
