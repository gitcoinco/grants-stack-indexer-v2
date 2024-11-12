import { getAddress } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "projectRepository" | "evmProvider" | "metadataProvider" | "logger"
>;
/**
 * Handles the ProfileOwnerUpdated event for the Registry contract from Allo protocol.
 */
export class ProfileOwnerUpdatedHandler
    implements IEventHandler<"Registry", "ProfileOwnerUpdated">
{
    constructor(
        readonly event: ProcessorEvent<"Registry", "ProfileOwnerUpdated">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {}
    async handle(): Promise<Changeset[]> {
        return [
            {
                type: "DeleteAllProjectRolesByRole",
                args: {
                    projectRole: {
                        chainId: this.chainId,
                        projectId: this.event.params.profileId,
                        role: "owner",
                    },
                },
            },
            {
                type: "InsertProjectRole",
                args: {
                    projectRole: {
                        chainId: this.chainId,
                        projectId: this.event.params.profileId,
                        address: getAddress(this.event.params.owner),
                        role: "owner",
                        createdAtBlock: BigInt(this.event.blockNumber),
                    },
                },
            },
        ];
    }
}
