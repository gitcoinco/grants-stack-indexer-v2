import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "projectRepository" | "evmProvider" | "metadataProvider" | "logger"
>;
/**
 * Handles the RoleRevoked event for the Registry contract from Allo protocol.
 */
export class RoleRevokedHandler implements IEventHandler<"Registry", "RoleRevoked"> {
    constructor(
        readonly event: ProcessorEvent<"Registry", "RoleRevoked">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {}
    async handle(): Promise<Changeset[]> {
        return [];
    }
}
