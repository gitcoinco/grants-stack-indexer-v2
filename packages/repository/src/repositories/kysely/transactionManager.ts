import { Kysely } from "kysely";

import { Database, ITransactionManager } from "../../internal.js";

export class KyselyTransactionManager implements ITransactionManager<Kysely<Database>> {
    constructor(private readonly db: Kysely<Database>) {}

    /** @inheritdoc */
    async runInTransaction<T>(fn: (tx: Kysely<Database>) => Promise<T>): Promise<T> {
        return this.db.transaction().execute(fn);
    }
}
