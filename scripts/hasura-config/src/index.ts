import { configDotenv } from "dotenv";
import { z } from "zod";

import { CustomFunction, HasuraMetadataApi, RelationshipConfig } from "./internal.js";

configDotenv();

const DEFAULT_PUBLIC_FETCH_LIMIT = 50;

const envSchema = z.object({
    HASURA_ENDPOINT: z.string().url(),
    HASURA_ADMIN_SECRET: z.string().min(1),
    HASURA_SCHEMA: z.string().min(1).default("public"),
    HASURA_PUBLIC_FETCH_LIMIT: z.coerce.number().int().min(1).default(DEFAULT_PUBLIC_FETCH_LIMIT),
});

// Tables to track
const tables = [
    "projects",
    "pending_project_roles",
    "project_roles",
    "rounds",
    "pending_round_roles",
    "round_roles",
    "applications",
    "applications_payouts",
    "donations",
    "legacy_projects",
    "attestations",
    "attestation_txns",
    "events_registry",
] as const;

type Tables = typeof tables;

// Custom functions to track
const customFunctions: CustomFunction[] = [
    {
        name: "search_projects",
        schema: "public",
    },
];

export const virtualObjectRelationships: RelationshipConfig<Tables>[] = [
    {
        name: "donation",
        table: {
            name: "attestation_txns",
            schema: "public",
        },
        source: "default",
        using: {
            manual_configuration: {
                remote_table: {
                    name: "donations",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    txn_hash: "transaction_hash",
                    chain_id: "chain_id",
                },
            },
        },
    },
];

export const virtualArrayRelationships: RelationshipConfig<Tables>[] = [
    {
        name: "attestationTransactions",
        table: {
            name: "donations",
            schema: "public",
        },
        source: "default",
        using: {
            manual_configuration: {
                remote_table: {
                    name: "attestation_txns",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    transaction_hash: "txn_hash",
                    chain_id: "chain_id",
                },
            },
        },
    },
    {
        name: "projects",
        table: {
            name: "applications",
            schema: "public",
        },
        source: "default",
        using: {
            manual_configuration: {
                remote_table: {
                    name: "projects",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    project_id: "id",
                },
            },
        },
    },
];

async function configureHasura(): Promise<void> {
    // Parse and validate environment variables
    const env = envSchema.parse(process.env);

    const hasuraApi = new HasuraMetadataApi<Tables>({
        endpoint: env.HASURA_ENDPOINT,
        adminSecret: env.HASURA_ADMIN_SECRET,
        schema: env.HASURA_SCHEMA,
        fetchLimit: env.HASURA_PUBLIC_FETCH_LIMIT,
    });

    await hasuraApi.clearMetadata();

    for (const table of tables) {
        await hasuraApi.trackTable(table);
        await hasuraApi.setSelectPermission(table);
    }

    await hasuraApi.createSuggestedRelationships(Array.from(tables));

    for (const relationship of virtualArrayRelationships) {
        await hasuraApi.createArrayRelationship(relationship);
    }

    for (const relationship of virtualObjectRelationships) {
        await hasuraApi.createObjectRelationship(relationship);
    }

    for (const func of customFunctions) {
        await hasuraApi.trackFunction(func);
    }

    console.log("✅ Hasura configured");
}

configureHasura().catch((error) => {
    console.error(error);
    process.exit(1);
});
