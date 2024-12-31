import { Kysely } from "kysely";

import { Database, IDonationRepository, NewDonation } from "../../internal.js";

export class KyselyDonationRepository implements IDonationRepository<Kysely<Database>> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async insertDonation(donation: NewDonation, tx?: Kysely<Database>): Promise<void> {
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
    async insertManyDonations(donations: NewDonation[], tx?: Kysely<Database>): Promise<void> {
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
