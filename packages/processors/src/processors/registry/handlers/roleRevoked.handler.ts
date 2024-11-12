import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies, ProjectByRoleNotFound } from "../../../internal.js";

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
    ) {}
    async handle(): Promise<Changeset[]> {
        const { projectRepository } = this.dependencies;
        const account = getAddress(this.event.params.account);
        const role = this.event.params.role.toLowerCase();
        const project = await projectRepository.getProjectById(this.chainId, role);

        // The role value for a member is the profileId in Allo V1
        // which is the project id in this database.
        // If we don't find a project with that id we can't remove the role.
        if (!project) {
            throw new ProjectByRoleNotFound(this.chainId, role);
        }

        return [
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
    }
}
