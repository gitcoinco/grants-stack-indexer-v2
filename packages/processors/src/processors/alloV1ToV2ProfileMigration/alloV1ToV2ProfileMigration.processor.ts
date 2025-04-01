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
    ) {
        this.dependencies.logger?.debug("Initializing AlloV1ToV2ProfileMigrationProcessor", {
            className: "AlloV1ToV2ProfileMigrationProcessor",
            chainId: this.chainId,
        });
    }

    async process(
        event: ProcessorEvent<"AlloV1ToV2ProfileMigration", AlloV1ToV2ProfileMigrationEvent>,
    ): Promise<Changeset[]> {
        const { logger } = this.dependencies;

        logger?.debug("Starting event processing", {
            className: "AlloV1ToV2ProfileMigrationProcessor",
            methodName: "process",
            eventName: event.eventName,
            chainId: this.chainId,
            blockNumber: event.blockNumber,
        });

        try {
            let result: Changeset[];

            switch (event.eventName) {
                case "ProfileMigrated":
                    logger?.debug("Delegating to ProfileMigratedHandler", {
                        className: "AlloV1ToV2ProfileMigrationProcessor",
                        methodName: "process",
                        v1ProjectId: event.params.alloV1,
                        v1ChainId: event.params.alloV1ChainId.toString(),
                        v2ProjectId: event.params.alloV2,
                    });

                    result = await new ProfileMigratedHandler(
                        event as ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                default:
                    logger?.error("Unsupported event encountered", {
                        className: "AlloV1ToV2ProfileMigrationProcessor",
                        methodName: "process",
                        eventName: event.eventName,
                        chainId: this.chainId,
                    });
                    throw new UnsupportedEventException(
                        "AlloV1ToV2ProfileMigration",
                        event.eventName,
                    );
            }

            logger?.info("Event processing completed", {
                className: "AlloV1ToV2ProfileMigrationProcessor",
                methodName: "process",
                eventName: event.eventName,
                chainId: this.chainId,
                changesetCount: result.length,
            });

            return result;
        } catch (error) {
            logger?.error("Error processing event", {
                className: "AlloV1ToV2ProfileMigrationProcessor",
                methodName: "process",
                eventName: event.eventName,
                chainId: this.chainId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
