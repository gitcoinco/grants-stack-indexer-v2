import { Kysely, sql } from "kysely";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
    const CHAIN_ID_TYPE = "integer";
    const BIGINT_TYPE = sql`decimal(78,0)`;
    const ADDRESS_TYPE = "text";

    await db.schema
        .createTable("attestations")
        .addColumn("uid", "text")
        .addColumn("chainId", CHAIN_ID_TYPE)
        .addColumn("fee", BIGINT_TYPE)
        .addColumn("recipient", ADDRESS_TYPE)
        .addColumn("refUID", "text")
        .addColumn("projectsContributed", BIGINT_TYPE)
        .addColumn("roundsContributed", BIGINT_TYPE)
        .addColumn("chainIdsContributed", BIGINT_TYPE)
        .addColumn("totalUSDAmount", BIGINT_TYPE)
        .addColumn("timestamp", "timestamptz")
        .addColumn("metadataCid", "text")
        .addColumn("metadata", "jsonb")
        .addUniqueConstraint("unique_uid_chainId", ["uid", "chainId"])
        .addPrimaryKeyConstraint("attestations_pkey", ["uid", "chainId"])
        .execute();

    await db.schema
        .createTable("attestation_txns")
        .addColumn("txnHash", "text")
        .addColumn("chainId", CHAIN_ID_TYPE)

        // Add the foreign key columns
        .addColumn("attestationUid", "text")
        .addColumn("attestationChainId", CHAIN_ID_TYPE)

        // Add Constraints
        .addUniqueConstraint("unique_txnHash_chainId_attestationUid", [
            "txnHash",
            "chainId",
            "attestationUid",
        ])

        .addForeignKeyConstraint(
            "attestation_txns_attestations_fkey",
            ["attestationUid", "attestationChainId"],
            "attestations",
            ["uid", "chainId"],
            (cb) => cb.onDelete("cascade"),
        )
        .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("attestation_txns").execute();
    await db.schema.dropTable("attestations").execute();
}
