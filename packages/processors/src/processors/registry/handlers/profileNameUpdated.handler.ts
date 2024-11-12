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
    ) {}
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        return [
            {
                type: "UpdateProject",
                args: {
                    chainId: this.chainId,
                    projectId: this.event.params.profileId,
                    project: {
                        name: this.event.params.name,
                        anchorAddress: getAddress(this.event.params.anchor),
                    },
                },
            },
        ];
    }
}
