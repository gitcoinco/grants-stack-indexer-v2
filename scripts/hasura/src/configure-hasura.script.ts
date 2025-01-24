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
] as const;

type Tables = typeof tables;

// Array relationships to track
const arrayRelationships: RelationshipConfig<Tables>[] = [
    // Projects array relationships
    {
        name: "applications",
        table: {
            name: "projects",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "applications",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    id: "project_id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    {
        name: "projectRoles",
        table: {
            name: "projects",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "project_roles",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    id: "project_id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    {
        name: "rounds",
        table: {
            name: "projects",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "rounds",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    id: "project_id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    // Rounds array relationships
    {
        name: "applications",
        table: {
            name: "rounds",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "applications",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    id: "round_id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    {
        name: "roundRoles",
        table: {
            name: "rounds",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "round_roles",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    id: "round_id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    // Applications array relationships
    {
        name: "applicationsPayouts",
        table: {
            name: "applications",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "applications_payouts",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    id: "application_id",
                    chain_id: "chain_id",
                    round_id: "round_id",
                },
            },
        },
        source: "default",
    },
];

// Object relationships to track
const objectRelationships: RelationshipConfig<Tables>[] = [
    // Project roles object relationships
    {
        name: "project",
        table: {
            name: "project_roles",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "projects",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    project_id: "id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    // Rounds object relationships
    {
        name: "project",
        table: {
            name: "rounds",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "projects",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    project_id: "id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    // Round roles object relationships
    {
        name: "round",
        table: {
            name: "round_roles",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "rounds",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    round_id: "id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    // Applications object relationships
    {
        name: "project",
        table: {
            name: "applications",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "projects",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    project_id: "id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    {
        name: "round",
        table: {
            name: "applications",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "rounds",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    round_id: "id",
                    chain_id: "chain_id",
                },
            },
        },
        source: "default",
    },
    // Applications payouts object relationships
    {
        name: "application",
        table: {
            name: "applications_payouts",
            schema: "public",
        },
        using: {
            manual_configuration: {
                remote_table: {
                    name: "applications",
                    schema: "public",
                },
                source: "default",
                column_mapping: {
                    application_id: "id",
                    chain_id: "chain_id",
                    round_id: "round_id",
                },
            },
        },
        source: "default",
    },
];

// Custom functions to track
const customFunctions: CustomFunction[] = [
    {
        name: "search_projects",
        schema: "public",
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

    for (const relationship of arrayRelationships) {
        await hasuraApi.createArrayRelationship(relationship);
    }

    for (const relationship of objectRelationships) {
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
