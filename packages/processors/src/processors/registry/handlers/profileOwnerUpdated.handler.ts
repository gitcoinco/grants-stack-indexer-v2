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
        return [];
    }
}
