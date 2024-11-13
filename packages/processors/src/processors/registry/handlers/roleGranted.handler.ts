import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ALLO_OWNER_ROLE, ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler } from "../../../internal.js";
import { ProcessorDependencies } from "../../../types/processor.types.js";

/**
 * Handles the RoleGranted event for the Registry contract from Allo protocol.
 */
export class RoleGrantedHandler implements IEventHandler<"Registry", "RoleGranted"> {
    constructor(
        readonly event: ProcessorEvent<"Registry", "RoleGranted">,
        readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {}
    async handle(): Promise<Changeset[]> {
        const { projectRepository } = this.dependencies;
        const role = this.event.params.role.toLowerCase();
        if (role === ALLO_OWNER_ROLE) {
            return [];
        }

        const account = getAddress(this.event.params.account);
        const project = await projectRepository.getProjectById(this.chainId, role);

        // The member role for an Allo V2 profile, is the profileId itself.
        // If a project exist with that id, we create the member role
        // If it doesn't exist we create a pending project role. This can happen
        // when a new project is created, since in Allo V2 the RoleGranted event for a member is
        // emitted before the ProfileCreated event.
        if (project) {
            return [
                {
                    type: "InsertProjectRole",
                    args: {
                        projectRole: {
                            chainId: this.chainId,
                            projectId: project.id,
                            address: account,
                            role: "member",
                            createdAtBlock: BigInt(this.event.blockNumber),
                        },
                    },
                },
            ];
        }

        return [
            {
                type: "InsertPendingProjectRole",
                args: {
                    pendingProjectRole: {
                        chainId: this.chainId,
                        role: role,
                        address: account,
                        createdAtBlock: BigInt(this.event.blockNumber),
                    },
                },
            },
        ];
    }
}
