import { Kysely } from "kysely";

import {
    Database,
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
        const queryBuilder = (tx || this.db).withSchema(this.schemaName);
        await queryBuilder.insertInto("applicationsPayouts").values(applicationPayout).execute();
    }
}
