import { RawBuilder, sql } from "kysely";

export function stringArrayToJsonb(value: string[]): RawBuilder<string[]> {
    return sql`CAST(${JSON.stringify(value)} AS jsonb)`;
}
