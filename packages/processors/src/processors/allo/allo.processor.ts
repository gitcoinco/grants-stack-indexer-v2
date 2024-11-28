import { Changeset } from "@grants-stack-indexer/repository";
import { AlloEvent, ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import type { IProcessor, ProcessorDependencies } from "../../internal.js";
import { UnsupportedEventException } from "../../internal.js";
import {
    PoolCreatedHandler,
    PoolFundedHandler,
    PoolMetadataUpdatedHandler,
    RoleGrantedHandler,
    RoleRevokedHandler,
} from "./handlers/index.js";

/**
 * AlloProcessor handles the processing of Allo V2 events from the Allo contract by delegating them to the appropriate handler
 */
export class AlloProcessor implements IProcessor<"Allo", AlloEvent> {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {}

    async process(event: ProcessorEvent<"Allo", AlloEvent>): Promise<Changeset[]> {
        switch (event.eventName) {
            case "PoolCreated":
                return new PoolCreatedHandler(
                    event as ProcessorEvent<"Allo", "PoolCreated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "PoolFunded":
                return new PoolFundedHandler(
                    event as ProcessorEvent<"Allo", "PoolFunded">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "RoleGranted":
                return new RoleGrantedHandler(
                    event as ProcessorEvent<"Allo", "RoleGranted">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "PoolMetadataUpdated":
                return new PoolMetadataUpdatedHandler(
                    event as ProcessorEvent<"Allo", "PoolMetadataUpdated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "RoleRevoked":
                return new RoleRevokedHandler(
                    event as ProcessorEvent<"Allo", "RoleRevoked">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            default:
                throw new UnsupportedEventException("Allo", event.eventName);
        }
    }
}
