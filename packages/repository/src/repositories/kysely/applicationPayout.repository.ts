import { Kysely } from "kysely";

import { Database, IApplicationPayoutRepository, NewApplicationPayout } from "../../internal.js";

export class KyselyApplicationPayoutRepository implements IApplicationPayoutRepository {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async insertApplicationPayout(applicationPayout: NewApplicationPayout): Promise<void> {
        await this.db
            .withSchema(this.schemaName)
            .insertInto("applicationsPayouts")
            .values(applicationPayout)
            .execute();
    }
}
