import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent, RegistryEvent } from "@grants-stack-indexer/shared";

import type { IProcessor } from "../../internal.js";
import { UnsupportedEventException } from "../../internal.js";
import { ProcessorDependencies } from "../../types/processor.types.js";
import {
    ProfileCreatedHandler,
    ProfileMetadataUpdatedHandler,
    ProfileNameUpdatedHandler,
    ProfileOwnerUpdatedHandler,
    RoleGrantedHandler,
    RoleRevokedHandler,
} from "./handlers/index.js";

export class RegistryProcessor implements IProcessor<"Registry", RegistryEvent> {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {
        this.dependencies.logger?.debug("Initializing RegistryProcessor", {
            className: "RegistryProcessor",
            chainId: this.chainId,
        });
    }

    async process(event: ProcessorEvent<"Registry", RegistryEvent>): Promise<Changeset[]> {
        const { logger } = this.dependencies;

        logger?.debug("Starting event processing", {
            className: "RegistryProcessor",
            methodName: "process",
            eventName: event.eventName,
            chainId: this.chainId,
            blockNumber: event.blockNumber,
        });

        try {
            let result: Changeset[];

            switch (event.eventName) {
                case "ProfileCreated":
                    logger?.debug("Delegating to ProfileCreatedHandler", {
                        className: "RegistryProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new ProfileCreatedHandler(
                        event as ProcessorEvent<"Registry", "ProfileCreated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "ProfileMetadataUpdated":
                    logger?.debug("Delegating to ProfileMetadataUpdatedHandler", {
                        className: "RegistryProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new ProfileMetadataUpdatedHandler(
                        event as ProcessorEvent<"Registry", "ProfileMetadataUpdated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "ProfileNameUpdated":
                    logger?.debug("Delegating to ProfileNameUpdatedHandler", {
                        className: "RegistryProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new ProfileNameUpdatedHandler(
                        event as ProcessorEvent<"Registry", "ProfileNameUpdated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "ProfileOwnerUpdated":
                    logger?.debug("Delegating to ProfileOwnerUpdatedHandler", {
                        className: "RegistryProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new ProfileOwnerUpdatedHandler(
                        event as ProcessorEvent<"Registry", "ProfileOwnerUpdated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "RoleGranted":
                    logger?.debug("Delegating to RoleGrantedHandler", {
                        className: "RegistryProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new RoleGrantedHandler(
                        event as ProcessorEvent<"Registry", "RoleGranted">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "RoleRevoked":
                    logger?.debug("Delegating to RoleRevokedHandler", {
                        className: "RegistryProcessor",
                        methodName: "process",
                        params: event.params,
                    });
                    result = await new RoleRevokedHandler(
                        event as ProcessorEvent<"Registry", "RoleRevoked">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                default:
                    logger?.error("Unsupported event encountered", {
                        className: "RegistryProcessor",
                        methodName: "process",
                        eventName: event.eventName,
                        chainId: this.chainId,
                    });
                    throw new UnsupportedEventException("Registry", event.eventName);
            }

            logger?.info("Event processing completed", {
                className: "RegistryProcessor",
                methodName: "process",
                eventName: event.eventName,
                chainId: this.chainId,
                changesetCount: result.length,
            });

            return result;
        } catch (error) {
            logger?.error("Error processing event", {
                className: "RegistryProcessor",
                methodName: "process",
                eventName: event.eventName,
                chainId: this.chainId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
