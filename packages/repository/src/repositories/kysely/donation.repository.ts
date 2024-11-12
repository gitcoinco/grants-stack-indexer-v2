import { Kysely } from "kysely";

import { IDonationRepository } from "../../interfaces/donationRepository.interface.js";
import { Database, NewDonation } from "../../internal.js";

export class KyselyDonationRepository implements IDonationRepository {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async insertDonation(donation: NewDonation): Promise<void> {
        await this.db
            .withSchema(this.schemaName)
            .insertInto("donations")
            .values(donation)
            .onConflict((c) => {
                return c.column("id").doNothing();
            })
            .execute();
    }

    /** @inheritdoc */
    async insertManyDonations(donations: NewDonation[]): Promise<void> {
        await this.db
            .withSchema(this.schemaName)
            .insertInto("donations")
            .values(donations)
            .onConflict((c) => {
                return c.column("id").doNothing();
            })
            .execute();
    }
}
