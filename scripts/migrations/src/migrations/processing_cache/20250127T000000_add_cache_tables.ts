import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    const ADDRESS_TYPE = "text";
    const CHAIN_ID_TYPE = "integer";
    // Create pricing cache table
    await db.schema
        .createTable("priceCache")
        .addColumn("tokenCode", "text", (col) => col.notNull())
        .addColumn("timestampMs", "bigint", (col) => col.notNull())
        .addColumn("priceUsd", "decimal(36, 18)", (col) => col.notNull())
        .addColumn("createdAt", "timestamptz", (col) => col.defaultTo(sql`now()`))
        .addPrimaryKeyConstraint("pricing_cache_pkey", ["tokenCode", "timestampMs"])
        .execute();
    // Create metadata cache table
    await db.schema
        .createTable("metadataCache")
        .addColumn("id", "text", (col) => col.notNull())
        .addColumn("metadata", "jsonb")
        .addColumn("createdAt", "timestamptz", (col) => col.defaultTo(sql`now()`))
        .addPrimaryKeyConstraint("metadata_cache_pkey", ["id"])
        .execute();
    // Create strategy timings cache table
    await db.schema
        .createTable("strategy_timings")
        .addColumn("strategyId", "text", (col) => col.notNull())
        .addColumn("address", ADDRESS_TYPE, (col) => col.notNull())
        .addColumn("timings", "jsonb")
        .addColumn("createdAt", "timestamptz", (col) => col.defaultTo(sql`now()`))
        .addPrimaryKeyConstraint("strategy_timings_cache_pkey", ["address"])
        .execute();

    await db.schema
        .createTable("strategies_registry")
        .addColumn("address", ADDRESS_TYPE, (col) => col.notNull())
        .addColumn("id", "text")
        .addColumn("chainId", CHAIN_ID_TYPE, (col) => col.notNull())
        .addColumn("handled", "boolean")
        .addPrimaryKeyConstraint("strategies_registry_pkey", ["address", "chainId"])
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("priceCache").execute();
    await db.schema.dropTable("metadataCache").execute();
    await db.schema.dropTable("strategy_timings").execute();
    await db.schema.dropTable("strategies_registry").execute();
}
