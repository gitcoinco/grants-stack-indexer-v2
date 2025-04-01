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
    ) {
        this.dependencies.logger?.debug("Initializing RoleGrantedHandler", {
            className: "RoleGrantedHandler",
            chainId: this.chainId,
            role: this.event.params.role,
            blockNumber: this.event.blockNumber,
        });
    }

    async handle(): Promise<Changeset[]> {
        const { projectRepository, logger } = this.dependencies;
        const role = this.event.params.role.toLowerCase();

        logger?.debug("Starting role grant handling", {
            className: "RoleGrantedHandler",
            methodName: "handle",
            role,
            blockNumber: this.event.blockNumber,
        });

        if (role === ALLO_OWNER_ROLE) {
            logger?.debug("Skipping Allo owner role grant", {
                className: "RoleGrantedHandler",
                methodName: "handle",
                role,
            });
            return [];
        }

        const account = getAddress(this.event.params.account);

        logger?.debug("Fetching project for role", {
            className: "RoleGrantedHandler",
            methodName: "handle",
            role,
            account,
        });

        const project = await projectRepository.getProjectById(this.chainId, role);

        if (project) {
            logger?.info("Creating member role for existing project", {
                className: "RoleGrantedHandler",
                methodName: "handle",
                projectId: project.id,
                account,
                role,
            });

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

        logger?.info("Creating pending project role", {
            className: "RoleGrantedHandler",
            methodName: "handle",
            role,
            account,
            chainId: this.chainId,
        });

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
