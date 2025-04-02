import { getAddress } from "viem";

import { Changeset, ProjectType } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";
import { ProjectMetadata, ProjectMetadataSchema } from "../../../schemas/projectMetadata.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "projectRepository" | "evmProvider" | "metadataProvider" | "logger"
>;
/**
 * Handles the ProfileCreated event for the Registry contract from Allo protocol.
 *
 * This handler performs the following steps:
 * - Fetches the metadata for the profile from the metadata provider
 * - Parses the metadata to extract the project type
 * - Returns the changeset to insert the project with the metadata
 *
 * If the metadata is not valid, it sets the metadata to null and the project type to canonical.
 */
export class ProfileCreatedHandler implements IEventHandler<"Registry", "ProfileCreated"> {
    constructor(
        readonly event: ProcessorEvent<"Registry", "ProfileCreated">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing ProfileCreatedHandler", {
            className: "ProfileCreatedHandler",
            chainId: this.chainId,
            profileId: this.event.params.profileId,
            blockNumber: this.event.blockNumber,
        });
    }

    async handle(): Promise<Changeset[]> {
        const { metadataProvider, evmProvider, projectRepository, logger } = this.dependencies;
        const profileId = this.event.params.profileId;
        const metadataCid = this.event.params.metadata[1];

        logger?.debug("Starting profile creation handling", {
            className: "ProfileCreatedHandler",
            methodName: "handle",
            profileId,
            metadataCid,
            name: this.event.params.name,
        });

        logger?.debug("Fetching profile metadata", {
            className: "ProfileCreatedHandler",
            methodName: "handle",
            profileId,
            metadataCid,
        });

        const metadata = await metadataProvider.getMetadata(metadataCid);

        logger?.debug("Parsing metadata", {
            className: "ProfileCreatedHandler",
            methodName: "handle",
            profileId,
            hasMetadata: !!metadata,
        });

        const parsedMetadata = ProjectMetadataSchema.safeParse(metadata);

        let projectType: ProjectType = "canonical";
        let isProgram = false;
        let metadataValue = null;

        if (parsedMetadata.success) {
            logger?.debug("Metadata validation successful", {
                className: "ProfileCreatedHandler",
                methodName: "handle",
                profileId,
                metadataType: parsedMetadata.data.type,
            });

            projectType = this.getProjectTypeFromMetadata(parsedMetadata.data);
            isProgram = parsedMetadata.data.type === "program";
            metadataValue = parsedMetadata.data;
        } else {
            logger?.warn("Invalid metadata format", {
                className: "ProfileCreatedHandler",
                methodName: "handle",
                profileId,
                errors: parsedMetadata.error.errors,
            });
        }

        logger?.debug("Fetching transaction creator", {
            className: "ProfileCreatedHandler",
            methodName: "handle",
            profileId,
            txHash: this.event.transactionFields.hash,
        });

        const createdBy =
            this.event.transactionFields.from ??
            (await evmProvider.getTransaction(this.event.transactionFields.hash)).from;
        const programTags = isProgram ? ["program"] : [];

        logger?.debug("Creating project record", {
            className: "ProfileCreatedHandler",
            methodName: "handle",
            profileId,
            projectType,
            isProgram,
            createdBy,
        });

        const changes: Changeset[] = [
            {
                type: "InsertProject",
                args: {
                    project: {
                        tags: ["allo-v2", ...programTags],
                        chainId: this.chainId,
                        registryAddress: getAddress(this.event.srcAddress),
                        id: profileId,
                        name: this.event.params.name,
                        nonce: BigInt(this.event.params.nonce),
                        anchorAddress: getAddress(this.event.params.anchor),
                        projectNumber: null,
                        metadataCid: metadataCid,
                        metadata: metadataValue,
                        createdByAddress: getAddress(createdBy),
                        createdAtBlock: BigInt(this.event.blockNumber),
                        updatedAtBlock: BigInt(this.event.blockNumber),
                        projectType,
                        timestamp: new Date(this.event.blockTimestamp),
                    },
                },
            },
            {
                type: "InsertProjectRole",
                args: {
                    projectRole: {
                        chainId: this.chainId,
                        projectId: profileId,
                        address: getAddress(this.event.params.owner),
                        role: "owner",
                        createdAtBlock: BigInt(this.event.blockNumber),
                    },
                },
            },
        ];

        logger?.debug("Fetching pending project roles", {
            className: "ProfileCreatedHandler",
            methodName: "handle",
            profileId,
        });

        const pendingProjectRoles = await projectRepository.getPendingProjectRolesByRole(
            this.chainId,
            profileId,
        );

        if (pendingProjectRoles.length !== 0) {
            logger?.debug("Processing pending project roles", {
                className: "ProfileCreatedHandler",
                methodName: "handle",
                profileId,
                pendingRolesCount: pendingProjectRoles.length,
            });

            for (const role of pendingProjectRoles) {
                logger?.debug("Adding member role", {
                    className: "ProfileCreatedHandler",
                    methodName: "handle",
                    profileId,
                    memberAddress: role.address,
                });

                changes.push({
                    type: "InsertProjectRole",
                    args: {
                        projectRole: {
                            chainId: this.chainId,
                            projectId: profileId,
                            address: getAddress(role.address),
                            role: "member",
                            createdAtBlock: BigInt(this.event.blockNumber),
                        },
                    },
                });
            }

            changes.push({
                type: "DeletePendingProjectRoles",
                args: { ids: pendingProjectRoles.map((r) => r.id!) },
            });
        }

        logger?.info("Profile creation completed", {
            className: "ProfileCreatedHandler",
            methodName: "handle",
            profileId,
            projectType,
            changeCount: changes.length,
            pendingRolesProcessed: pendingProjectRoles.length,
        });

        return changes;
    }

    private getProjectTypeFromMetadata(metadata: ProjectMetadata): ProjectType {
        const projectType = "canonical" in metadata ? "linked" : "canonical";
        this.dependencies.logger?.debug("Determined project type", {
            className: "ProfileCreatedHandler",
            methodName: "getProjectTypeFromMetadata",
            projectType,
            hasCanonicalField: "canonical" in metadata,
        });
        return projectType;
    }
}
