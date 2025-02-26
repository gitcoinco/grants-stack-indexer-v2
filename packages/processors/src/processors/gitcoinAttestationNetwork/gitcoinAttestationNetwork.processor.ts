import { Changeset } from "@grants-stack-indexer/repository";
import {
    ChainId,
    GitcoinAttestationNetworkEvent,
    ProcessorEvent,
} from "@grants-stack-indexer/shared";

import type { IProcessor } from "../../internal.js";
import { UnsupportedEventException } from "../../internal.js";
import { ProcessorDependencies } from "../../types/processor.types.js";
import { OnAttestedHandler } from "./handlers/index.js";

export class GitcoinAttestationNetworkProcessor
    implements IProcessor<"GitcoinAttestationNetwork", GitcoinAttestationNetworkEvent>
{
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {}

    async process(
        event: ProcessorEvent<"GitcoinAttestationNetwork", GitcoinAttestationNetworkEvent>,
    ): Promise<Changeset[]> {
        switch (event.eventName) {
            case "OnAttested":
                return new OnAttestedHandler(event, this.chainId, this.dependencies).handle();
            default:
                throw new UnsupportedEventException("GitcoinAttestationNetwork", event.eventName);
        }
    }
}
