import { SchemaModule } from "kysely";

/**
 * Since WithSchemaPlugin doesn't work with `sql.table`, we need to get the schema name manually.
 * ref: https://github.com/kysely-org/kysely/issues/761
 */
export const getSchemaName = (schema: SchemaModule): string => {
    let name = "public";
    schema.createTable("test").$call((b) => {
        name = b.toOperationNode().table.table.schema?.name ?? "public";
    });
    return name;
};
