import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "logger">;
/**
 * Handles the ProfileMigrated event for the Registry contract from Allo protocol.
 *
 * This handler extracts the alloV1, alloV1ChainId, and alloV2 parameters from the event
 * and creates a changeset to insert a new legacy project mapping between V1 and V2.
 */
export class ProfileMigratedHandler
    implements IEventHandler<"AlloV1ToV2ProfileMigration", "ProfileMigrated">
{
    constructor(
        readonly event: ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated">,
        readonly chainId: ChainId,
        private dependencies: Dependencies,
    ) {}
    async handle(): Promise<Changeset[]> {
        const { alloV1, alloV1ChainId, alloV2 } = this.event.params;

        const changes: Changeset[] = [
            {
                type: "InsertLegacyProject",
                args: {
                    legacyProject: {
                        v1ProjectId: alloV1,
                        v1ChainId: Number(alloV1ChainId) as ChainId,
                        v2ProjectId: alloV2,
                    },
                },
            },
        ];

        return changes;
    }
}
