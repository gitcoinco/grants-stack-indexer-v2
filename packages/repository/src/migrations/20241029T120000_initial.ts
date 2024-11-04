import { Kysely, sql } from "kysely";

import { getSchemaName } from "../db/helpers.js";

/**
 * The up function is called when you update your database schema to the next version and down when you go back to previous version.
 * The only argument for the functions is an instance of Kysely<any>. It's important to use Kysely<any> and not Kysely<YourDatabase>.
 * ref: https://kysely.dev/docs/migrations#migration-files
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    const BIGINT_TYPE = sql`decimal(78,0)`;
    const ADDRESS_TYPE = "text";
    const CHAIN_ID_TYPE = "integer";
    const PENDING_ROLE_TYPE = "text";
    const CURRENCY_TYPE = sql`numeric(18,2)`;

    const schema = getSchemaName(db.schema);
    await db.schema.createType("project_type").asEnum(["canonical", "linked"]).execute();

    console.log("schema", schema);

    await db.schema
        .createTable("projects")
        .addColumn("id", "text")
        .addColumn("name", "text")
        .addColumn("nonce", BIGINT_TYPE)
        .addColumn("anchorAddress", ADDRESS_TYPE)
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("projectNumber", "integer")
        .addColumn("registryAddress", ADDRESS_TYPE)
        .addColumn("metadataCid", "text")
        .addColumn("metadata", "jsonb")
        .addColumn("createdByAddress", ADDRESS_TYPE)
        .addColumn("createdAtBlock", BIGINT_TYPE)
        .addColumn("updatedAtBlock", BIGINT_TYPE)
        .addColumn("tags", sql`text[]`)
        .addColumn("projectType", sql.table(`${schema}.project_type`))

        .addPrimaryKeyConstraint("projects_pkey", ["id", "chainId"])
        .execute();

    await db.schema
        .createIndex("idx_projects_metadata_hash")
        .on("projects")
        .expression(sql`md5(metadata::text)`)
        .where(sql.ref("metadata"), "is not", null)
        .execute();

    await db.schema
        .createTable("pending_project_roles")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("role", PENDING_ROLE_TYPE)
        .addColumn("address", ADDRESS_TYPE)
        .addColumn("createdAtBlock", BIGINT_TYPE)
        .execute();

    await db.schema.createType("project_role_name").asEnum(["owner", "member"]).execute();

    await db.schema
        .createTable("project_roles")
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("projectId", "text")
        .addColumn("address", ADDRESS_TYPE)
        .addColumn("role", sql.table(`${schema}.project_role_name`))
        .addColumn("createdAtBlock", BIGINT_TYPE)
        .addPrimaryKeyConstraint("project_roles_pkey", ["chainId", "projectId", "address", "role"])
        .addForeignKeyConstraint(
            "project_roles_projects_fkey",
            ["chainId", "projectId"],
            "projects",
            ["chainId", "id"],
        )
        .execute();

    await db.schema
        .createTable("rounds")
        .addColumn("id", "text")
        .addColumn("chainId", CHAIN_ID_TYPE)

        .addColumn("tags", sql`text[]`)

        .addColumn("matchAmount", BIGINT_TYPE)
        .addColumn("matchTokenAddress", ADDRESS_TYPE)
        .addColumn("matchAmountInUsd", CURRENCY_TYPE)

        .addColumn("fundedAmount", BIGINT_TYPE, (col) => col.defaultTo("0"))
        .addColumn("fundedAmountInUsd", CURRENCY_TYPE, (col) => col.defaultTo("0"))

        .addColumn("applicationMetadataCid", "text")
        .addColumn("applicationMetadata", "jsonb")
        .addColumn("roundMetadataCid", "text")
        .addColumn("roundMetadata", "jsonb")

        .addColumn("applicationsStartTime", "timestamptz")
        .addColumn("applicationsEndTime", "timestamptz")
        .addColumn("donationsStartTime", "timestamptz")
        .addColumn("donationsEndTime", "timestamptz")

        .addColumn("createdByAddress", ADDRESS_TYPE)
        .addColumn("createdAtBlock", BIGINT_TYPE)
        .addColumn("updatedAtBlock", BIGINT_TYPE)

        // POOL_MANAGER_ROLE = bytes32(poolId);
        .addColumn("managerRole", "text")
        // POOL_ADMIN_ROLE = keccak256(abi.encodePacked(poolId, "admin"));
        .addColumn("adminRole", "text")

        .addColumn("strategyAddress", "text")
        .addColumn("strategyId", "text")
        .addColumn("strategyName", "text")

        .addColumn("matchingDistribution", "jsonb")
        .addColumn("readyForPayoutTransaction", "text")

        .addColumn("projectId", "text")

        .addForeignKeyConstraint("rounds_projects_fkey", ["chainId", "projectId"], "projects", [
            "chainId",
            "id",
        ])

        // aggregates

        .addColumn("totalAmountDonatedInUsd", CURRENCY_TYPE)
        .addColumn("totalDonationsCount", "integer")
        .addColumn("uniqueDonorsCount", "integer")
        .addColumn("totalDistributed", BIGINT_TYPE, (col) => col.defaultTo("0"))

        .addPrimaryKeyConstraint("rounds_pkey", ["id", "chainId"])
        .execute();

    await db.schema
        .createIndex("idx_rounds_manager_role")
        .on("rounds")
        .columns(["managerRole"])
        .execute();

    await db.schema
        .createIndex("idx_rounds_admin_role")
        .on("rounds")
        .columns(["adminRole"])
        .execute();

    await db.schema
        .createIndex("idx_rounds_round_metadata_not_null")
        .on("rounds")
        .expression(sql`md5(round_metadata::text)`)
        .where(sql.ref("round_metadata"), "is not", null)
        .execute();

    await db.schema
        .createTable("pending_round_roles")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("role", PENDING_ROLE_TYPE)
        .addColumn("address", ADDRESS_TYPE)
        .addColumn("createdAtBlock", BIGINT_TYPE)
        .execute();

    await db.schema.createType("round_role_name").asEnum(["admin", "manager"]).execute();

    await db.schema
        .createTable("round_roles")
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("roundId", "text")
        .addColumn("address", ADDRESS_TYPE)
        .addColumn("role", sql.table(`${schema}.round_role_name`))
        .addColumn("createdAtBlock", BIGINT_TYPE)
        .addPrimaryKeyConstraint("round_roles_pkey", ["chainId", "roundId", "address", "role"])
        .addForeignKeyConstraint("round_roles_rounds_fkey", ["chainId", "roundId"], "rounds", [
            "chainId",
            "id",
        ])
        .execute();

    await db.schema
        .createType("application_status")
        .asEnum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "IN_REVIEW"])
        .execute();

    await db.schema
        .createTable("applications")
        .addColumn("id", "text")
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("roundId", ADDRESS_TYPE)
        .addColumn("projectId", "text")
        .addColumn("anchorAddress", ADDRESS_TYPE)
        .addColumn("status", sql.table(`${schema}.application_status`))
        .addColumn("statusSnapshots", "jsonb")
        .addColumn("distributionTransaction", "text")

        .addColumn("metadataCid", "text")
        .addColumn("metadata", "jsonb")

        .addColumn("createdByAddress", ADDRESS_TYPE)
        .addColumn("createdAtBlock", BIGINT_TYPE)
        .addColumn("statusUpdatedAtBlock", BIGINT_TYPE)

        // aggregates
        .addColumn("totalDonationsCount", "integer")
        .addColumn("totalAmountDonatedInUsd", CURRENCY_TYPE)
        .addColumn("uniqueDonorsCount", "integer")

        .addColumn("tags", sql`text[]`)

        .addPrimaryKeyConstraint("applications_pkey", ["chainId", "roundId", "id"])
        .addForeignKeyConstraint(
            "applications_rounds_fkey",
            ["roundId", "chainId"],
            "rounds",
            ["id", "chainId"],
            (cb) => cb.onDelete("cascade"),
        )

        .execute();

    await db.schema
        .createTable("applications_payouts")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("applicationId", "text")
        .addColumn("roundId", "text")
        .addColumn("amount", BIGINT_TYPE)
        .addColumn("tokenAddress", ADDRESS_TYPE)
        .addColumn("amountInUsd", CURRENCY_TYPE)
        .addColumn("amountInRoundMatchToken", "text")
        .addColumn("transactionHash", "text")
        .addColumn("timestamp", "timestamptz")
        .addColumn("sender", ADDRESS_TYPE)
        .addForeignKeyConstraint(
            "applications_payouts_applications_fkey",
            ["chainId", "roundId", "applicationId"],
            "applications",
            ["chainId", "roundId", "id"],
            (cb) => cb.onDelete("cascade"),
        )
        .execute();

    await db.schema
        .createTable("donations")

        .addColumn("id", "text")
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("roundId", ADDRESS_TYPE)
        .addColumn("applicationId", "text")
        .addColumn("donorAddress", ADDRESS_TYPE)
        .addColumn("recipientAddress", ADDRESS_TYPE)
        .addColumn("projectId", "text")
        .addColumn("transactionHash", "text")
        .addColumn("blockNumber", BIGINT_TYPE)
        .addColumn("tokenAddress", ADDRESS_TYPE)

        .addColumn("timestamp", "timestamptz")

        .addColumn("amount", BIGINT_TYPE)
        .addColumn("amountInUsd", CURRENCY_TYPE)
        .addColumn("amountInRoundMatchToken", BIGINT_TYPE)

        .addPrimaryKeyConstraint("donations_pkey", ["id"])

        .execute();

    await db.schema
        .createIndex("idx_donations_donor_chain")
        .on("donations")
        .columns(["donorAddress"])
        .execute();

    await db.schema
        .createIndex("idx_donations_chain_round")
        .on("donations")
        .columns(["chainId", "roundId"])
        .execute();

    await db.schema
        .createIndex("idx_donations_chain_round_app")
        .on("donations")
        .columns(["chainId", "roundId", "applicationId"])
        .execute();

    await db.schema
        .createTable("legacy_projects")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("v1ProjectId", "text")
        .addColumn("v2ProjectId", "text")
        .addUniqueConstraint("unique_v1ProjectId", ["v1ProjectId"])
        .addUniqueConstraint("unique_v2ProjectId", ["v2ProjectId"])
        .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    // Drop everything in reverse order
    await db.schema.dropTable("legacy_projects").execute();
    await db.schema.dropTable("donations").execute();
    await db.schema.dropTable("applications_payouts").execute();
    await db.schema.dropTable("applications").execute();
    await db.schema.dropType("application_status").execute();
    await db.schema.dropTable("round_roles").execute();
    await db.schema.dropType("round_role_name").execute();
    await db.schema.dropTable("pending_round_roles").execute();
    await db.schema.dropTable("rounds").execute();
    await db.schema.dropTable("project_roles").execute();
    await db.schema.dropType("project_role_name").execute();
    await db.schema.dropTable("pending_project_roles").execute();
    await db.schema.dropTable("projects").execute();
    await db.schema.dropType("project_type").execute();
}
