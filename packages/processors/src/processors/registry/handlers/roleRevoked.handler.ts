import { getAddress } from "viem";

import { Changeset, ProjectByRoleNotFound } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "projectRepository" | "logger">;
/**
 * Handles the RoleRevoked event for the Registry contract from Allo protocol.
 *
 * This handler performs the following steps:
 *
 * - Returns the changeset to delete all project roles with the role "member"
 * for the profile and address.
 *
 * If the project with the role id doesn't exist, it throws an error.
 */
export class RoleRevokedHandler implements IEventHandler<"Registry", "RoleRevoked"> {
    constructor(
        readonly event: ProcessorEvent<"Registry", "RoleRevoked">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing RoleRevokedHandler", {
            className: "RoleRevokedHandler",
            chainId: this.chainId,
            role: this.event.params.role,
            blockNumber: this.event.blockNumber,
        });
    }
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { projectRepository, logger } = this.dependencies;
        const account = getAddress(this.event.params.account);
        const role = this.event.params.role.toLowerCase();

        logger?.debug("Starting role revocation handling", {
            className: "RoleRevokedHandler",
            methodName: "handle",
            role,
            account,
            blockNumber: this.event.blockNumber,
        });

        logger?.debug("Fetching project for role", {
            className: "RoleRevokedHandler",
            methodName: "handle",
            role,
            chainId: this.chainId,
        });

        const project = await projectRepository.getProjectById(this.chainId, role);

        // The role value for a member is the profileId in Allo V1
        // which is the project id in this database.
        // If we don't find a project with that id we can't remove the role.
        if (!project) {
            logger?.error("Project not found for role", {
                className: "RoleRevokedHandler",
                methodName: "handle",
                role,
                chainId: this.chainId,
                account,
            });
            throw new ProjectByRoleNotFound(this.chainId, role);
        }

        logger?.debug("Revoking member role", {
            className: "RoleRevokedHandler",
            methodName: "handle",
            projectId: project.id,
            account,
            role,
        });

        const changes: Changeset[] = [
            {
                type: "DeleteAllProjectRolesByRoleAndAddress",
                args: {
                    projectRole: {
                        chainId: this.chainId,
                        projectId: project.id,
                        address: account,
                        role: "member",
                    },
                },
            },
        ];

        logger?.info("Role revocation completed", {
            className: "RoleRevokedHandler",
            methodName: "handle",
            projectId: project.id,
            account,
            role,
            changeCount: changes.length,
        });

        return changes;
    }
}
