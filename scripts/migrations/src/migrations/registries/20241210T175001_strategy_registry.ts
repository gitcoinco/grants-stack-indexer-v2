import { Kysely } from "kysely";

import { getSchemaName } from "../../utils/index.js";

/**
 * The up function is called when you update your database schema to the next version and down when you go back to previous version.
 * The only argument for the functions is an instance of Kysely<any>. It's important to use Kysely<any> and not Kysely<YourDatabase>.
 * ref: https://kysely.dev/docs/migrations#migration-files
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    const ADDRESS_TYPE = "text";
    const CHAIN_ID_TYPE = "integer";

    const schema = getSchemaName(db.schema);

    console.log("schema", schema);

    await db.schema
        .createTable("strategies")
        .addColumn("address", ADDRESS_TYPE)
        .addColumn("id", "text")
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("handled", "boolean")
        .addPrimaryKeyConstraint("strategies_pkey", ["address", "chainId"])
        .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    // Drop everything in reverse order
    await db.schema.dropTable("strategies").execute();
}
