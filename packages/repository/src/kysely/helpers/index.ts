import { RawBuilder, sql } from "kysely";

/**
 * Converts a string array to a JSONB SQL expression.
 * @param value - The string array to convert to JSONB.
 * @returns A raw SQL builder that casts the array to JSONB type.
 */
export function stringArrayToJsonb(value: string[]): RawBuilder<string[]> {
    return sql`CAST(${JSON.stringify(value)} AS jsonb)`;
}
