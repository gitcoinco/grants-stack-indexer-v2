import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "projectRepository" | "evmProvider" | "metadataProvider" | "logger"
>;
/**
 * Handles the ProfileNameUpdated event for the Registry contract from Allo protocol.
 */
export class ProfileNameUpdatedHandler implements IEventHandler<"Registry", "ProfileNameUpdated"> {
    constructor(
        readonly event: ProcessorEvent<"Registry", "ProfileNameUpdated">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {}
    async handle(): Promise<Changeset[]> {
        return [];
    }
}
