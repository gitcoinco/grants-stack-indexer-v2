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
    ) {
        this.dependencies.logger?.debug("Initializing ProfileMetadataUpdatedHandler", {
            className: "ProfileMetadataUpdatedHandler",
            chainId: this.chainId,
            profileId: this.event.params.profileId,
            blockNumber: this.event.blockNumber,
        });
    }
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { metadataProvider, logger } = this.dependencies;
        const profileId = this.event.params.profileId;
        const metadataCid = this.event.params.metadata[1];

        logger?.debug("Starting profile metadata update", {
            className: "ProfileMetadataUpdatedHandler",
            methodName: "handle",
            profileId,
            metadataCid,
            blockNumber: this.event.blockNumber,
        });

        logger?.debug("Fetching metadata", {
            className: "ProfileMetadataUpdatedHandler",
            methodName: "handle",
            profileId,
            metadataCid,
        });

        const metadata = await metadataProvider.getMetadata(metadataCid);

        logger?.debug("Parsing metadata", {
            className: "ProfileMetadataUpdatedHandler",
            methodName: "handle",
            profileId,
            hasMetadata: !!metadata,
        });

        const parsedMetadata = ProjectMetadataSchema.safeParse(metadata);

        if (!parsedMetadata.success) {
            logger?.warn("Invalid metadata format", {
                className: "ProfileMetadataUpdatedHandler",
                methodName: "handle",
                profileId,
                errors: parsedMetadata.error.errors,
            });

            logger?.debug("Creating update with null metadata", {
                className: "ProfileMetadataUpdatedHandler",
                methodName: "handle",
                profileId,
                projectType: "canonical",
            });

            return [
                {
                    type: "UpdateProject",
                    args: {
                        chainId: this.chainId,
                        projectId: profileId,
                        project: {
                            metadataCid: metadataCid,
                            metadata: null,
                            projectType: "canonical",
                        },
                    },
                },
            ];
        }

        logger?.debug("Determining project type from metadata", {
            className: "ProfileMetadataUpdatedHandler",
            methodName: "handle",
            profileId,
            metadataType: parsedMetadata.data.type,
        });

        const projectType = this.getProjectTypeFromMetadata(parsedMetadata.data);

        logger?.info("Profile metadata update completed", {
            className: "ProfileMetadataUpdatedHandler",
            methodName: "handle",
            profileId,
            projectType,
            metadataCid,
        });

        return [
            {
                type: "UpdateProject",
                args: {
                    chainId: this.chainId,
                    projectId: profileId,
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
        const projectType = "canonical" in metadata ? "linked" : "canonical";
        this.dependencies.logger?.debug("Determined project type", {
            className: "ProfileMetadataUpdatedHandler",
            methodName: "getProjectTypeFromMetadata",
            projectType,
            hasCanonicalField: "canonical" in metadata,
        });
        return projectType;
    }
}
