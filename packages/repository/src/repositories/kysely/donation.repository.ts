import { Kysely } from "kysely";

import { Database, IDonationRepository, KyselyTransaction, NewDonation } from "../../internal.js";

export class KyselyDonationRepository implements IDonationRepository<KyselyTransaction> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async insertDonation(donation: NewDonation, tx?: KyselyTransaction): Promise<void> {
        const queryBuilder = (tx || this.db).withSchema(this.schemaName);

        await queryBuilder
            .insertInto("donations")
            .values(donation)
            .onConflict((c) => {
                return c.column("id").doNothing();
            })
            .execute();
    }

    /** @inheritdoc */
    async insertManyDonations(donations: NewDonation[], tx?: KyselyTransaction): Promise<void> {
        const queryBuilder = (tx || this.db).withSchema(this.schemaName);

        await queryBuilder
            .insertInto("donations")
            .values(donations)
            .onConflict((c) => {
                return c.column("id").doNothing();
            })
            .execute();
    }
}
