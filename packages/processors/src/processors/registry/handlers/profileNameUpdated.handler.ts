import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "logger">;
/**
 * Handles the ProfileNameUpdated event for the Registry contract from Allo protocol.
 *
 * This handler performs the following steps:
 * - Returns the changeset to update the project with the new name
 */
export class ProfileNameUpdatedHandler implements IEventHandler<"Registry", "ProfileNameUpdated"> {
    constructor(
        readonly event: ProcessorEvent<"Registry", "ProfileNameUpdated">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing ProfileNameUpdatedHandler", {
            className: "ProfileNameUpdatedHandler",
            chainId: this.chainId,
            profileId: this.event.params.profileId,
            blockNumber: this.event.blockNumber,
        });
    }
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { logger } = this.dependencies;
        const profileId = this.event.params.profileId;
        const newName = this.event.params.name;
        const newAnchor = getAddress(this.event.params.anchor);

        logger?.debug("Starting profile name update", {
            className: "ProfileNameUpdatedHandler",
            methodName: "handle",
            profileId,
            newName,
            newAnchor,
            blockNumber: this.event.blockNumber,
        });

        const changes: Changeset[] = [
            {
                type: "UpdateProject",
                args: {
                    chainId: this.chainId,
                    projectId: profileId,
                    project: {
                        name: newName,
                        anchorAddress: newAnchor,
                    },
                },
            },
        ];

        logger?.info("Profile name update completed", {
            className: "ProfileNameUpdatedHandler",
            methodName: "handle",
            profileId,
            newName,
            newAnchor,
            changeCount: changes.length,
        });

        return changes;
    }
}
