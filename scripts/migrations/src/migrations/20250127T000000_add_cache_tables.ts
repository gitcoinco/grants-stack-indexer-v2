import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    // Create pricing cache table
    await db.schema
        .createTable("priceCache")
        .addColumn("tokenCode", "text", (col) => col.notNull())
        .addColumn("timestampMs", "integer", (col) => col.notNull())
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("priceCache").execute();
    await db.schema.dropTable("metadataCache").execute();
}
