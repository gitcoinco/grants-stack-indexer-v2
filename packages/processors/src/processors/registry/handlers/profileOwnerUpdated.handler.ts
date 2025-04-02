import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "logger">;
/**
 * Handles the ProfileOwnerUpdated event for the Registry contract from Allo protocol.
 *
 * This handler performs the following steps:
 *
 * - Returns the changeset to delete all project roles with the role "owner"
 * for the profile and insert a new project role with the new owner address.
 */
export class ProfileOwnerUpdatedHandler
    implements IEventHandler<"Registry", "ProfileOwnerUpdated">
{
    constructor(
        readonly event: ProcessorEvent<"Registry", "ProfileOwnerUpdated">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing ProfileOwnerUpdatedHandler", {
            className: "ProfileOwnerUpdatedHandler",
            chainId: this.chainId,
            profileId: this.event.params.profileId,
            blockNumber: this.event.blockNumber,
        });
    }
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { logger } = this.dependencies;
        const profileId = this.event.params.profileId;
        const newOwner = getAddress(this.event.params.owner);

        logger?.debug("Starting profile owner update", {
            className: "ProfileOwnerUpdatedHandler",
            methodName: "handle",
            profileId,
            newOwner,
            blockNumber: this.event.blockNumber,
        });

        logger?.debug("Removing existing owner roles", {
            className: "ProfileOwnerUpdatedHandler",
            methodName: "handle",
            profileId,
            chainId: this.chainId,
        });

        const changes: Changeset[] = [
            {
                type: "DeleteAllProjectRolesByRole",
                args: {
                    projectRole: {
                        chainId: this.chainId,
                        projectId: profileId,
                        role: "owner",
                    },
                },
            },
            {
                type: "InsertProjectRole",
                args: {
                    projectRole: {
                        chainId: this.chainId,
                        projectId: profileId,
                        address: newOwner,
                        role: "owner",
                        createdAtBlock: BigInt(this.event.blockNumber),
                    },
                },
            },
        ];

        logger?.info("Profile owner update completed", {
            className: "ProfileOwnerUpdatedHandler",
            methodName: "handle",
            profileId,
            newOwner,
            changeCount: changes.length,
            blockNumber: this.event.blockNumber,
        });

        return changes;
    }
}
