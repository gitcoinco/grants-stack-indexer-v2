import { Kysely } from "kysely";

import { Database, ITransactionManager, KyselyTransaction } from "../../internal.js";

export class KyselyTransactionManager implements ITransactionManager<KyselyTransaction> {
    constructor(private readonly db: Kysely<Database>) {}

    /** @inheritdoc */
    async runInTransaction<T>(fn: (tx: KyselyTransaction) => Promise<T>): Promise<T> {
        return this.db.transaction().execute(fn);
    }
}
