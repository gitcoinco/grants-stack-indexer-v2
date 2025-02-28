import { Changeset } from "@grants-stack-indexer/repository";
import {
    AlloV1ToV2ProfileMigrationEvent,
    ChainId,
    ProcessorEvent,
} from "@grants-stack-indexer/shared";

import type { IProcessor, ProcessorDependencies } from "../../internal.js";
import { UnsupportedEventException } from "../../internal.js";
import { ProfileMigratedHandler } from "./handlers/index.js";

/**
 * AlloV1ToV2ProfileMigration handles the processing of Allo V1 to V2 profile migration events
 */
export class AlloV1ToV2ProfileMigrationProcessor
    implements IProcessor<"AlloV1ToV2ProfileMigration", AlloV1ToV2ProfileMigrationEvent>
{
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {}

    async process(
        event: ProcessorEvent<"AlloV1ToV2ProfileMigration", AlloV1ToV2ProfileMigrationEvent>,
    ): Promise<Changeset[]> {
        switch (event.eventName) {
            case "ProfileMigrated":
                return new ProfileMigratedHandler(
                    event as ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            default:
                throw new UnsupportedEventException("AlloV1ToV2ProfileMigration", event.eventName);
        }
    }
}
