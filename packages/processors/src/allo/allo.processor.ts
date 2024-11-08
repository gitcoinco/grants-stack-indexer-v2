import { Changeset } from "@grants-stack-indexer/repository";
import { AlloEvent, ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import type { IProcessor, ProcessorDependencies } from "../internal.js";
import { UnsupportedEventException } from "../internal.js";
import { PoolCreatedHandler } from "./handlers/index.js";

/**
 * AlloProcessor handles the processing of Allo V2 events by delegating them to the appropriate handler
 */
export class AlloProcessor implements IProcessor<"Allo", AlloEvent> {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {}

    async process(event: ProcessorEvent<"Allo", AlloEvent>): Promise<Changeset[]> {
        switch (event.eventName) {
            case "PoolCreated":
                return new PoolCreatedHandler(event, this.chainId, this.dependencies).handle();
            default:
                throw new UnsupportedEventException("Allo", event.eventName);
        }
    }
}
