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
    ) {}

    async process(event: ProcessorEvent<"Registry", RegistryEvent>): Promise<Changeset[]> {
        //TODO: Implement robust error handling and retry logic
        switch (event.eventName) {
            case "ProfileCreated":
                return new ProfileCreatedHandler(
                    event as ProcessorEvent<"Registry", "ProfileCreated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "ProfileMetadataUpdated":
                return new ProfileMetadataUpdatedHandler(
                    event as ProcessorEvent<"Registry", "ProfileMetadataUpdated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "ProfileNameUpdated":
                return new ProfileNameUpdatedHandler(
                    event as ProcessorEvent<"Registry", "ProfileNameUpdated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "ProfileOwnerUpdated":
                return new ProfileOwnerUpdatedHandler(
                    event as ProcessorEvent<"Registry", "ProfileOwnerUpdated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "RoleGranted":
                return new RoleGrantedHandler(
                    event as ProcessorEvent<"Registry", "RoleGranted">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "RoleRevoked":
                return new RoleRevokedHandler(
                    event as ProcessorEvent<"Registry", "RoleRevoked">,
                    this.chainId,
                    this.dependencies,
                ).handle();

            default:
                throw new UnsupportedEventException("Registry", event.eventName);
        }
    }
}
