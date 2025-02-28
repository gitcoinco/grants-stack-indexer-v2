import axios, { AxiosError, AxiosInstance, isAxiosError } from "axios";
import { camelize, singularize } from "inflection";

import type { CustomFunction, HasuraConfig, RelationshipConfig } from "../internal.js";
import { HasuraApiException, NetworkException } from "../internal.js";

type FetchFkRelationshipResult = {
    result: [string[], string[]];
}[];

interface FkRelationship {
    table_schema: string;
    table_name: string;
    constraint_name: string;
    ref_table_table_schema: string;
    ref_table: string;
    column_mapping: { [key: string]: string };
    on_update?: string;
    on_delete?: string;
    // Other optional fields if needed...
}

/**
 * A class to interact with the Hasura Metadata API for managing database configurations,
 * including tracking tables, setting up relationships, and configuring permissions.
 * Provides methods to programmatically update Hasura's metadata through its HTTP API.
 *
 * refer to: https://hasura.io/docs/2.0/api-reference/metadata-api/index/
 *
 * @template Tables - An array of table names.
 */
export class HasuraMetadataApi<Tables extends readonly string[]> {
    private adminSecret: string;
    private endpoint: string;
    private schema: string;
    private fetchLimit: number;
    private axiosInstance: AxiosInstance;

    constructor(config: HasuraConfig) {
        this.adminSecret = config.adminSecret;
        this.endpoint = config.endpoint;
        this.schema = config.schema;
        this.fetchLimit = config.fetchLimit;
        this.axiosInstance = axios.create({
            baseURL: this.endpoint,
            headers: {
                "Content-Type": "application/json",
                "X-Hasura-Admin-Secret": this.adminSecret,
            },
        });
    }

    /**
     * Clears the metadata in Hasura.
     *
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the metadata clearing fails.
     * @throws {NetworkException} If there is a network error.
     */
    async clearMetadata(): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "clear_metadata",
                args: {},
            });
            console.log("✅ Metadata cleared");
        } catch (err) {
            this.handleError(err, "clear metadata");
        }
    }

    /**
     * Tracks a table in Hasura.
     *
     * @param {Tables[number]} tableName - The name of the table to track.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the table tracking fails.
     * @throws {NetworkException} If there is a network error.
     */
    async trackTable(tableName: Tables[number]): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_track_table",
                args: {
                    source: "default",
                    table: {
                        name: tableName,
                        schema: this.schema,
                    },
                },
            });
            console.log(`✅ Tracked table: ${tableName}`);
        } catch (err) {
            this.handleError(err, `track ${tableName} table`);
        }
    }

    /**
     * Retrieves suggested relationships to create between tables in Hasura.
     *
     * @param {Tables[number][]} tables - The tables to suggest relationships for.
     * @returns {Promise<FetchFkRelationshipResult>}
     * @throws {HasuraApiException} If the relationship suggestion fails.
     * @throws {NetworkException} If there is a network error.
     */
    private async getFkRelationships(tables: Tables[number][]): Promise<FetchFkRelationshipResult> {
        try {
            const { data } = await this.axiosInstance.post<FetchFkRelationshipResult>(
                "/v2/query",
                this.getFetchFkRelationshipPayload(),
            );
            return data;
        } catch (err) {
            this.handleError(err, `suggest relationships for ${tables.join(", ")}`);
        }
    }

    /**
     * Creates suggested relationships between tables in Hasura.
     *
     * @param {Tables[number][]} tables - The tables to create relationships for.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the relationship creation fails.
     * @throws {NetworkException} If there is a network error.
     */
    async createSuggestedRelationships(tables: Tables[number][]): Promise<void> {
        const fkRelationships = await this.getFkRelationships(tables);
        const relationships = this.parseFkRelationships(fkRelationships);
        for (const fk of relationships) {
            // The table containing the FK (child)
            const childTable = { name: fk.table_name, schema: fk.table_schema };
            // The referenced table (parent)
            const parentTable = { name: fk.ref_table, schema: fk.ref_table_table_schema };

            // Extract columns from mapping
            const childColumns = Object.keys(fk.column_mapping);
            const parentColumns = Object.values(fk.column_mapping);

            if (childColumns.length !== parentColumns.length) {
                throw new Error("The number of columns in the mapping does not match");
            }

            // Object relationship: in the child table
            const objectRelationshipPayload = {
                name: singularize(camelize(parentTable.name)), // name derived from parent table
                table: childTable,
                source: "default",
                using: {
                    manual_configuration: {
                        remote_table: parentTable,
                        source: "default",
                        column_mapping: fk.column_mapping,
                    },
                },
            };

            // Array relationship: in the parent table (mapping is reversed)
            const reversedMapping: Record<string, string> = Object.fromEntries(
                parentColumns.map((col, i) => [col, childColumns[i] as string]),
            );

            const arrayRelationshipPayload = {
                name: camelize(childTable.name), // name derived from child table
                table: parentTable,
                source: "default",
                using: {
                    manual_configuration: {
                        remote_table: childTable,
                        source: "default",
                        column_mapping: reversedMapping,
                    },
                },
            };

            await this.createArrayRelationship(arrayRelationshipPayload);
            await this.createObjectRelationship(objectRelationshipPayload);
        }
    }

    /**
     * Creates an array relationship in Hasura.
     *
     * @param {RelationshipConfig<Tables>} relationship - The relationship configuration.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the array relationship creation fails.
     * @throws {NetworkException} If there is a network error.
     */
    async createArrayRelationship(relationship: RelationshipConfig<Tables>): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_create_array_relationship",
                args: relationship,
            });
            console.log(
                `✅ Created array relationship: ${relationship.name} for ${relationship.table.name}`,
            );
        } catch (err) {
            this.handleError(err, `create array relationship ${relationship.name}`);
        }
    }

    /**
     * Creates an object relationship in Hasura.
     *
     * @param {RelationshipConfig<Tables>} relationship - The relationship configuration.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the object relationship creation fails.
     * @throws {NetworkException} If there is a network error.
     */
    async createObjectRelationship(relationship: RelationshipConfig<Tables>): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_create_object_relationship",
                args: relationship,
            });
            console.log(
                `✅ Created object relationship: ${relationship.name} for ${relationship.table.name}`,
            );
        } catch (err) {
            this.handleError(err, `create object relationship ${relationship.name}`);
        }
    }

    /**
     * Sets a select permission for public role for a table in Hasura.
     *
     * @param {Tables[number]} tableName - The name of the table to set the permission for.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the select permission creation fails.
     * @throws {NetworkException} If there is a network error.
     */
    async setSelectPermission(tableName: Tables[number]): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_create_select_permission",
                args: {
                    table: {
                        name: tableName,
                        schema: this.schema,
                    },
                    source: "default",
                    role: "public",
                    permission: {
                        limit: this.fetchLimit,
                        allow_aggregations: true,
                        columns: "*",
                        filter: {},
                    },
                },
            });
            console.log(`✅ Set select permission for ${tableName}`);
        } catch (err) {
            this.handleError(err, `set select permission for ${tableName}`);
        }
    }

    /**
     * Tracks a custom function in Hasura.
     *
     * @param {CustomFunction} func - The function configuration.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the custom function tracking fails.
     * @throws {NetworkException} If there is a network error.
     */
    async trackFunction(func: CustomFunction): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_track_function",
                args: {
                    function: {
                        name: func.name,
                        schema: func.schema,
                    },
                    source: "default",
                },
            });
            console.log(`✅ Tracked function: ${func.name}`);
        } catch (err) {
            this.handleError(err, `track custom function ${func.name}`);
        }
    }

    /**
     * Handles errors from the Hasura API.
     *
     * @param {unknown} err - The error to handle.
     * @param {string} operation - The operation that failed.
     * @returns {never}
     */
    private handleError(err: unknown, operation: string): never {
        const error = err as Error | AxiosError;
        let errorMessage = `❌ Failed to ${operation}`;

        if (isAxiosError<{ error: string; code: string }>(error)) {
            if (!error.response) {
                // Network error
                throw new NetworkException(`Network error while ${operation}: ${error.message}`);
            }
            if (error.response.status >= 500) {
                // Server error
                throw new HasuraApiException(
                    `Server error while ${operation}: ${error.response.data || error.message}`,
                );
            }
            // Other API errors
            errorMessage += `: ${error.response.data.error}`;
        } else {
            errorMessage += `: ${error.message}`;
        }

        throw new HasuraApiException(errorMessage);
    }
    /**
     * Returns the payload for fetching FK relationships from Hasura API. This payload includes generic SQL queries to fetch FK relationships from the database.
     *
     * @returns {Object} The payload for fetching FK relationships.
     */
    private getFetchFkRelationshipPayload(): {
        type: string;
        source: string;
        args: {
            type: string;
            args: { source: string; sql: string; cascade: boolean; read_only: boolean };
        }[];
    } {
        return {
            type: "concurrent_bulk",
            source: "default",
            args: [
                {
                    type: "run_sql",
                    args: {
                        source: "default",
                        sql: "SELECT\n    COALESCE(Json_agg(Row_to_json(info)), '[]' :: json) AS tables\n  FROM (\n    WITH partitions AS (\n      SELECT array(\n        WITH partitioned_tables AS (SELECT array(SELECT oid FROM pg_class WHERE relkind = 'p') AS parent_tables)\n        SELECT\n        child.relname       AS partition\n    FROM partitioned_tables, pg_inherits\n        JOIN pg_class child             ON pg_inherits.inhrelid   = child.oid\n        JOIN pg_namespace nmsp_child    ON nmsp_child.oid   = child.relnamespace\n    where ((nmsp_child.nspname='public'))\n    AND pg_inherits.inhparent = ANY (partitioned_tables.parent_tables)\n      ) AS names\n    )\n    SELECT\n      pgn.nspname AS table_schema,\n      pgc.relname AS table_name,\n      CASE\n        WHEN pgc.relkind = 'r' THEN 'TABLE'\n        WHEN pgc.relkind = 'f' THEN 'FOREIGN TABLE'\n        WHEN pgc.relkind = 'v' THEN 'VIEW'\n        WHEN pgc.relkind = 'm' THEN 'MATERIALIZED VIEW'\n        WHEN pgc.relkind = 'p' THEN 'PARTITIONED TABLE'\n      END AS table_type,\n      obj_description(pgc.oid) AS comment,\n      COALESCE(json_agg(DISTINCT row_to_json(isc) :: jsonb || jsonb_build_object('comment', col_description(pga.attrelid, pga.attnum))) filter (WHERE isc.column_name IS NOT NULL), '[]' :: json) AS columns,\n      COALESCE(json_agg(DISTINCT row_to_json(ist) :: jsonb || jsonb_build_object('comment', obj_description(pgt.oid))) filter (WHERE ist.trigger_name IS NOT NULL), '[]' :: json) AS triggers,\n      row_to_json(isv) AS view_info\n      FROM partitions, pg_class as pgc\n      INNER JOIN pg_namespace as pgn\n        ON pgc.relnamespace = pgn.oid\n    /* columns */\n    /* This is a simplified version of how information_schema.columns was\n    ** implemented in postgres 9.5, but modified to support materialized\n    ** views.\n    */\n    LEFT OUTER JOIN pg_attribute AS pga\n      ON pga.attrelid = pgc.oid\n    LEFT OUTER JOIN (\n      SELECT\n        nc.nspname         AS table_schema,\n        c.relname          AS table_name,\n        a.attname          AS column_name,\n        a.attnum           AS ordinal_position,\n        pg_get_expr(ad.adbin, ad.adrelid) AS column_default,\n        CASE WHEN a.attnotnull OR (t.typtype = 'd' AND t.typnotnull) THEN 'NO' ELSE 'YES' END AS is_nullable,\n        CASE WHEN t.typtype = 'd' THEN\n          CASE WHEN bt.typelem <> 0 AND bt.typlen = -1 THEN 'ARRAY'\n               WHEN nbt.nspname = 'pg_catalog' THEN format_type(t.typbasetype, null)\n               ELSE 'USER-DEFINED' END\n        ELSE\n          CASE WHEN t.typelem <> 0 AND t.typlen = -1 THEN 'ARRAY'\n               WHEN nt.nspname = 'pg_catalog' THEN format_type(a.atttypid, null)\n               ELSE 'USER-DEFINED' END\n        END AS data_type,\n        coalesce(bt.typname, t.typname) AS data_type_name\n      FROM (pg_attribute a LEFT JOIN pg_attrdef ad ON attrelid = adrelid AND attnum = adnum)\n        JOIN (pg_class c JOIN pg_namespace nc ON (c.relnamespace = nc.oid)) ON a.attrelid = c.oid\n        JOIN (pg_type t JOIN pg_namespace nt ON (t.typnamespace = nt.oid)) ON a.atttypid = t.oid\n        LEFT JOIN (pg_type bt JOIN pg_namespace nbt ON (bt.typnamespace = nbt.oid))\n          ON (t.typtype = 'd' AND t.typbasetype = bt.oid)\n        LEFT JOIN (pg_collation co JOIN pg_namespace nco ON (co.collnamespace = nco.oid))\n          ON a.attcollation = co.oid AND (nco.nspname, co.collname) <> ('pg_catalog', 'default')\n      WHERE (NOT pg_is_other_temp_schema(nc.oid))\n        AND a.attnum > 0 AND NOT a.attisdropped AND c.relkind in ('r', 'v', 'm', 'f', 'p')\n        AND (pg_has_role(c.relowner, 'USAGE')\n             OR has_column_privilege(c.oid, a.attnum,\n                                     'SELECT, INSERT, UPDATE, REFERENCES'))\n    ) AS isc\n      ON  isc.table_schema = pgn.nspname\n      AND isc.table_name   = pgc.relname\n      AND isc.column_name  = pga.attname\n    /* triggers */\n    LEFT OUTER JOIN pg_trigger AS pgt\n      ON pgt.tgrelid = pgc.oid\n    LEFT OUTER JOIN information_schema.triggers AS ist\n      ON  ist.event_object_schema = pgn.nspname\n      AND ist.event_object_table  = pgc.relname\n      AND ist.trigger_name        = pgt.tgname\n    /* This is a simplified version of how information_schema.views was\n    ** implemented in postgres 9.5, but modified to support materialized\n    ** views.\n    */\n    LEFT OUTER JOIN (\n      SELECT\n        nc.nspname         AS table_schema,\n        c.relname          AS table_name,\n        CASE WHEN pg_has_role(c.relowner, 'USAGE') THEN pg_get_viewdef(c.oid) ELSE null END AS view_definition,\n        CASE WHEN pg_relation_is_updatable(c.oid, false) & 20 = 20 THEN 'YES' ELSE 'NO' END AS is_updatable,\n        CASE WHEN pg_relation_is_updatable(c.oid, false) &  8 =  8 THEN 'YES' ELSE 'NO' END AS is_insertable_into,\n        CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = c.oid AND tgtype & 81 = 81) THEN 'YES' ELSE 'NO' END AS is_trigger_updatable,\n        CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = c.oid AND tgtype & 73 = 73) THEN 'YES' ELSE 'NO' END AS is_trigger_deletable,\n        CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = c.oid AND tgtype & 69 = 69) THEN 'YES' ELSE 'NO' END AS is_trigger_insertable_into\n      FROM pg_namespace nc, pg_class c\n      WHERE c.relnamespace = nc.oid\n        AND c.relkind in ('v', 'm')\n        AND (NOT pg_is_other_temp_schema(nc.oid))\n        AND (pg_has_role(c.relowner, 'USAGE')\n             OR has_table_privilege(c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')\n             OR has_any_column_privilege(c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'))\n    ) AS isv\n      ON  isv.table_schema = pgn.nspname\n      AND isv.table_name   = pgc.relname\n    WHERE\n      pgc.relkind IN ('r', 'v', 'f', 'm', 'p')\n      and ((pgn.nspname='public'))\n    GROUP BY pgc.oid, pgn.nspname, pgc.relname, table_type, isv.*\n  ) AS info;",
                        cascade: false,
                        read_only: true,
                    },
                },
                {
                    type: "run_sql",
                    args: {
                        source: "default",
                        sql: "SELECT\n\tCOALESCE(json_agg(row_to_json(info)), '[]'::JSON)\nFROM (\n\tSELECT\n\t\tq.table_schema::text AS table_schema,\n\t\tq.table_name::text AS table_name,\n\t\tq.constraint_name::text AS constraint_name,\n\t\tmin(q.ref_table_table_schema::text) AS ref_table_table_schema,\n\t\tmin(q.ref_table::text) AS ref_table,\n\t\tjson_object_agg(ac.attname, afc.attname) AS column_mapping,\n\t\tmin(q.confupdtype::text) AS on_update,\n\t\tmin(q.confdeltype::text) AS\n\t\ton_delete\n\tFROM (\n\t\tSELECT\n\t\t\tctn.nspname AS table_schema,\n\t\t\tct.relname AS table_name,\n\t\t\tr.conrelid AS table_id,\n\t\t\tr.conname AS constraint_name,\n\t\t\tcftn.nspname AS ref_table_table_schema,\n\t\t\tcft.relname AS ref_table,\n\t\t\tr.confrelid AS ref_table_id,\n\t\t\tr.confupdtype,\n\t\t\tr.confdeltype,\n\t\t\tunnest(r.conkey) AS column_id,\n\t\t\tunnest(r.confkey) AS ref_column_id\n\t\tFROM\n\t\t\tpg_constraint r\n\t\t\tJOIN pg_class ct ON r.conrelid = ct.oid\n\t\t\tJOIN pg_namespace ctn ON ct.relnamespace = ctn.oid\n\t\t\tJOIN pg_class cft ON r.confrelid = cft.oid\n\t\t\tJOIN pg_namespace cftn ON cft.relnamespace = cftn.oid\n    WHERE\n      r.contype = 'f'::\"char\"\n      AND ((ctn.nspname='public'))\n      ) q\n\t\tJOIN pg_attribute ac ON q.column_id = ac.attnum\n\t\t\tAND q.table_id = ac.attrelid\n\t\tJOIN pg_attribute afc ON q.ref_column_id = afc.attnum\n\t\t\tAND q.ref_table_id = afc.attrelid\n\t\tGROUP BY\n\t\t\tq.table_schema,\n\t\t\tq.table_name,\n      q.constraint_name) AS info;",
                        cascade: false,
                        read_only: true,
                    },
                },
                {
                    type: "run_sql",
                    args: {
                        source: "default",
                        sql: "SELECT\nCOALESCE(\n  json_agg(\n    row_to_json(info)\n  ),\n  '[]' :: JSON\n)\nFROM (\nSELECT n.nspname::text AS table_schema,\n    ct.relname::text AS table_name,\n    r.conname::text AS constraint_name,\n    pg_get_constraintdef(r.oid, true) AS \"check\"\n   FROM pg_constraint r\n     JOIN pg_class ct ON r.conrelid = ct.oid\n     JOIN pg_namespace n ON ct.relnamespace = n.oid\n   where ((n.nspname='public'))\n   AND r.contype = 'c'::\"char\"\n   ) AS info;",
                        cascade: false,
                        read_only: true,
                    },
                },
                {
                    type: "run_sql",
                    args: {
                        source: "default",
                        sql: "SELECT\nCOALESCE(\n  json_agg(\n    row_to_json(info)\n  ),\n  '[]' :: JSON\n)\nFROM (\nSELECT n.nspname::text AS table_schema,\n    ct.relname::text AS table_name,\n    r.conname::text AS constraint_name,\n    pg_get_constraintdef(r.oid, true) AS \"check\"\n   FROM pg_constraint r\n     JOIN pg_class ct ON r.conrelid = ct.oid\n     JOIN pg_namespace n ON ct.relnamespace = n.oid\n   where ((n.nspname='public'))\n   AND r.contype = 'c'::\"char\"\n   ) AS info;",
                        cascade: false,
                        read_only: true,
                    },
                },
                {
                    type: "run_sql",
                    args: {
                        source: "default",
                        sql: "SELECT\nCOALESCE(\n  json_agg(\n    row_to_json(info)\n  ),\n  '[]' :: JSON\n)\nFROM (\nSELECT n.nspname::text AS table_schema,\n    ct.relname::text AS table_name,\n    r.conname::text AS constraint_name,\n    pg_get_constraintdef(r.oid, true) AS \"check\"\n   FROM pg_constraint r\n     JOIN pg_class ct ON r.conrelid = ct.oid\n     JOIN pg_namespace n ON ct.relnamespace = n.oid\n   where ((n.nspname='public'))\n   AND r.contype = 'c'::\"char\"\n   ) AS info;",
                        cascade: false,
                        read_only: true,
                    },
                },
            ],
        };
    }

    private parseFkRelationships(fkRelationships: FetchFkRelationshipResult): FkRelationship[] {
        const fkRelationshipsResult: FkRelationship[] = [];

        fkRelationships.forEach((item) => {
            // Each item.result is an array of two elements:
            // - The first is an array of strings (e.g., ["coalesce"] or ["tables"])
            // - The second is an array containing a JSON string with the results.
            const key = item.result[0][0];
            if (key === "coalesce") {
                try {
                    const relStr: string = item.result[1][0]!;
                    const relData: Record<string, unknown>[] = JSON.parse(relStr) as Record<
                        string,
                        unknown
                    >[];
                    relData.forEach((rel) => {
                        // If the object has the "constraint_name" property, we assume it's an FK relationship
                        if (rel.constraint_name && rel.ref_table) {
                            fkRelationshipsResult.push(rel as unknown as FkRelationship);
                        }
                    });
                } catch (error) {
                    console.error("Error al parsear relaciones:", error);
                }
            }
        });

        return fkRelationshipsResult;
    }
}
