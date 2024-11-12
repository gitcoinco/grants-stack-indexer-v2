import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "projectRepository" | "evmProvider" | "metadataProvider" | "logger"
>;
/**
 * Handles the ProfileMetadataUpdated event for the Registry contract from Allo protocol.
 */
export class ProfileMetadataUpdatedHandler
    implements IEventHandler<"Registry", "ProfileMetadataUpdated">
{
    constructor(
        readonly event: ProcessorEvent<"Registry", "ProfileMetadataUpdated">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {}
    async handle(): Promise<Changeset[]> {
        return [];
    }
}
