import { Kysely } from "kysely";

/**
 * The up function is called when you update your database schema to the next version and down when you go back to previous version.
 * The only argument for the functions is an instance of Kysely<any>. It's important to use Kysely<any> and not Kysely<YourDatabase>.
 * ref: https://kysely.dev/docs/migrations#migration-files
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    const CHAIN_ID_TYPE = "integer";

    await db.schema
        .createTable("events")
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("blockNumber", "integer")
        .addColumn("blockTimestamp", "integer")
        .addColumn("logIndex", "integer")
        .addColumn("rawEvent", "jsonb")
        .addPrimaryKeyConstraint("events_pkey", ["chainId"])
        .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    // Drop everything in reverse order
    await db.schema.dropTable("events").execute();
}
