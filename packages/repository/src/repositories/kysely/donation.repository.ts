import { Kysely } from "kysely";

import {
    Database,
    handlePostgresError,
    IDonationRepository,
    KyselyTransaction,
    NewDonation,
} from "../../internal.js";

export class KyselyDonationRepository implements IDonationRepository<KyselyTransaction> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /** @inheritdoc */
    async insertDonation(donation: NewDonation, tx?: KyselyTransaction): Promise<void> {
        const queryBuilder = (tx || this.db).withSchema(this.schemaName);
        try {
            await queryBuilder
                .insertInto("donations")
                .values(donation)
                .onConflict((c) => {
                    return c.column("id").doNothing();
                })
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyDonationRepository.name,
                methodName: "insertDonation",
                additionalData: {
                    donation,
                },
            });
        }
    }

    /** @inheritdoc */
    async insertManyDonations(donations: NewDonation[], tx?: KyselyTransaction): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);

            await queryBuilder
                .insertInto("donations")
                .values(donations)
                .onConflict((c) => {
                    return c.column("id").doNothing();
                })
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyDonationRepository.name,
                methodName: "insertManyDonations",
                additionalData: {
                    donations,
                },
            });
        }
    }
}
