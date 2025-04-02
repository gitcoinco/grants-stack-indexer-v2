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
    ) {
        this.dependencies.logger?.debug("Initializing AlloProcessor", {
            className: "AlloProcessor",
            chainId: this.chainId,
        });
    }

    async process(event: ProcessorEvent<"Allo", AlloEvent>): Promise<Changeset[]> {
        const { logger } = this.dependencies;

        logger?.debug("Starting event processing", {
            className: "AlloProcessor",
            methodName: "process",
            eventName: event.eventName,
            chainId: this.chainId,
            blockNumber: event.blockNumber,
        });

        try {
            let result: Changeset[];

            switch (event.eventName) {
                case "PoolCreated":
                    logger?.debug("Delegating to PoolCreatedHandler", {
                        className: "AlloProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new PoolCreatedHandler(
                        event as ProcessorEvent<"Allo", "PoolCreated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "PoolFunded":
                    logger?.debug("Delegating to PoolFundedHandler", {
                        className: "AlloProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new PoolFundedHandler(
                        event as ProcessorEvent<"Allo", "PoolFunded">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "RoleGranted":
                    logger?.debug("Delegating to RoleGrantedHandler", {
                        className: "AlloProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new RoleGrantedHandler(
                        event as ProcessorEvent<"Allo", "RoleGranted">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "PoolMetadataUpdated":
                    logger?.debug("Delegating to PoolMetadataUpdatedHandler", {
                        className: "AlloProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new PoolMetadataUpdatedHandler(
                        event as ProcessorEvent<"Allo", "PoolMetadataUpdated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "RoleRevoked":
                    logger?.debug("Delegating to RoleRevokedHandler", {
                        className: "AlloProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new RoleRevokedHandler(
                        event as ProcessorEvent<"Allo", "RoleRevoked">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                default:
                    logger?.error("Unsupported event encountered", {
                        className: "AlloProcessor",
                        methodName: "process",
                        eventName: event.eventName,
                        chainId: this.chainId,
                    });
                    throw new UnsupportedEventException("Allo", event.eventName);
            }

            logger?.info("Event processing completed", {
                className: "AlloProcessor",
                methodName: "process",
                eventName: event.eventName,
                chainId: this.chainId,
                changesetCount: result.length,
            });

            return result;
        } catch (error) {
            logger?.error("Error processing event", {
                className: "AlloProcessor",
                methodName: "process",
                eventName: event.eventName,
                chainId: this.chainId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
