import { Kysely, sql } from "kysely";

/**
 * Executes the "up" migration to create caching tables in the database.
 *
 * This function creates two tables:
 *
 * - **priceCache**: Stores pricing data with the following columns:
 *   - `tokenCode` (text): Not nullable.
 *   - `timestampMs` (bigint): Not nullable.
 *   - `priceUsd` (decimal(36, 18)): Not nullable.
 *   - `createdAt` (timestamptz): Defaults to the current timestamp.
 *   A composite primary key is defined on `tokenCode` and `timestampMs`.
 *
 * - **metadataCache**: Stores metadata with the following columns:
 *   - `id` (text): Not nullable.
 *   - `metadata` (jsonb): Nullable, allowing null values.
 *   - `createdAt` (timestamptz): Defaults to the current timestamp.
 *   A primary key is defined on the `id` column.
 *
 * @param db - The Kysely database instance used to execute the migration queries.
 * @returns A promise that resolves when the migration is complete.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("priceCache").execute();
    await db.schema.dropTable("metadataCache").execute();
}
