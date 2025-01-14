import { Kysely } from "kysely";

import {
    Database,
    handlePostgresError,
    IApplicationPayoutRepository,
    KyselyTransaction,
    NewApplicationPayout,
} from "../../internal.js";

export class KyselyApplicationPayoutRepository
    implements IApplicationPayoutRepository<KyselyTransaction>
{
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async insertApplicationPayout(
        applicationPayout: NewApplicationPayout,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder
                .insertInto("applicationsPayouts")
                .values(applicationPayout)
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyApplicationPayoutRepository.name,
                methodName: "insertApplicationPayout",
                additionalData: {
                    applicationPayout,
                },
            });
        }
    }
}
