import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "logger">;
/**
 * Handles the ProfileMigrated event for the Registry contract from Allo protocol.
 *
 * This handler performs the following steps:
 * - Fetches the metadata for the profile from the metadata provider
 * - Parses the metadata to extract the project type
 * - Returns the changeset to insert the project with the metadata
 *
 * If the metadata is not valid, it sets the metadata to null and the project type to canonical.
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
