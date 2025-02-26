import { Kysely } from "kysely";

import {
    Database,
    handlePostgresError,
    ILegacyProjectRepository,
    KyselyTransaction,
    NewLegacyProject,
} from "../../internal.js";

export class KyselyLegacyProjectRepository implements ILegacyProjectRepository<KyselyTransaction> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /* @inheritdoc */
    async insertLegacyProject(
        legacyProject: NewLegacyProject,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);

            await queryBuilder
                .insertInto("legacyProjects")
                .values({
                    ...legacyProject,
                })
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyLegacyProjectRepository.name,
                methodName: "insertLegacyProject",
                additionalData: {
                    legacyProject,
                },
            });
        }
    }
}
