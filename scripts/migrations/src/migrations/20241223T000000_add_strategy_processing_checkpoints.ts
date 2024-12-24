import { Kysely, sql } from "kysely";

/**
 * The up function is called when you update your database schema to the next version and down when you go back to previous version.
 * The only argument for the functions is an instance of Kysely<any>. It's important to use Kysely<any> and not Kysely<YourDatabase>.
 * ref: https://kysely.dev/docs/migrations#migration-files
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    const CHAIN_ID_TYPE = "integer";

    await db.schema
        .createTable("strategy_processing_checkpoints")
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("strategyId", "text")
        .addColumn("lastProcessedBlockNumber", "integer")
        .addColumn("lastProcessedLogIndex", "integer")
        .addColumn("createdAt", "timestamptz", (col) => col.defaultTo(sql`now()`))
        .addColumn("updatedAt", "timestamptz", (col) => col.defaultTo(sql`now()`))
        .addPrimaryKeyConstraint("strategy_processing_checkpoints_pkey", ["chainId", "strategyId"])
        .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("strategy_processing_checkpoints").execute();
}
