import { Kysely } from "kysely";

import { Database, IApplicationPayoutRepository, NewApplicationPayout } from "../../internal.js";

export class KyselyApplicationPayoutRepository
    implements IApplicationPayoutRepository<Kysely<Database>>
{
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async insertApplicationPayout(
        applicationPayout: NewApplicationPayout,
        tx?: Kysely<Database>,
    ): Promise<void> {
        const queryBuilder = (tx || this.db).withSchema(this.schemaName);
        await queryBuilder.insertInto("applicationsPayouts").values(applicationPayout).execute();
    }
}
