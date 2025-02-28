import { gql, GraphQLClient } from "graphql-request";
import { beforeAll, describe, expect, expectTypeOf, inject, it } from "vitest";

import { GlobalTestState } from "../../src/utils/test-environment.js";
import { TestHelper } from "../../src/utils/test-helper.js";

/**
 * Response type definitions for GraphQL queries
 */
interface ProjectResponse {
    projects: Array<{
        id: string;
        name: string;
        chainId: number;
    }>;
}

interface SchemaMetadataResponse {
    __schema: {
        types: Array<{
            name: string;
        }>;
        queryType: {
            fields: Array<{
                name: string;
            }>;
        };
    };
}

interface BlockEventsResponse {
    last_block_events: {
        aggregate: {
            count: number;
        };
        nodes: Array<{
            block_number: number;
        }>;
    };
}

describe("Base Setup", () => {
    let testHelper: TestHelper;
    let apiGraphQLClient: GraphQLClient;
    let indexerGraphQLClient: GraphQLClient;
    let globalState: GlobalTestState;

    /**
     * Setup test environment before all tests
     */
    beforeAll(async () => {
        globalState = {
            databaseUrl: inject("databaseUrl"),
            hasuraUrl: inject("hasuraUrl"),
            envioIndexerUrl: inject("envioIndexerUrl"),
        };

        testHelper = new TestHelper(globalState);
        await testHelper.resetDatabase();

        // Initialize GraphQL clients
        apiGraphQLClient = new GraphQLClient(`${globalState.hasuraUrl}/v1/graphql`);
        indexerGraphQLClient = new GraphQLClient(`${globalState.envioIndexerUrl}/v1/graphql`);
    });

    /**
     * Tests for the Mock Indexer Express Server
     */
    describe("Mock Indexer Express Server", () => {
        it("responds with empty block events", async () => {
            const response = await indexerGraphQLClient.request<BlockEventsResponse>(
                gql`
                    query getTotalEventsInBlock($chainId: Int!, $blockNumber: Int!) {
                        last_block_events: raw_events_aggregate(
                            where: {
                                chain_id: { _eq: $chainId }
                                block_number: { _eq: $blockNumber }
                            }
                        ) {
                            aggregate {
                                count
                            }
                            nodes {
                                block_number
                            }
                        }
                    }
                `,
                {
                    chainId: 1,
                    blockNumber: 1,
                },
            );

            expect(response).toEqual({
                last_block_events: {
                    aggregate: { count: 0 },
                    nodes: [],
                },
            });
        });
    });

    /**
     * Tests for the Hasura API
     */
    describe("Hasura API", () => {
        it("returns an empty array of projects", async () => {
            const response = await apiGraphQLClient.request<ProjectResponse>(gql`
                query GetProjects {
                    projects {
                        id
                        chainId
                        name
                    }
                }
            `);

            expect(response.projects).toHaveLength(0);
            expectTypeOf(response).toEqualTypeOf<ProjectResponse>();
        });

        it("has all expected base queries in the schema", async () => {
            const response = await apiGraphQLClient.request<SchemaMetadataResponse>(gql`
                query GetHasuraMetadata {
                    __schema {
                        types {
                            name
                        }
                        queryType {
                            fields {
                                name
                            }
                        }
                    }
                }
            `);

            // Verify expected types exist
            const types = response.__schema.types.map((t) => t.name.toLowerCase());
            const expectedTypes = [
                "applications",
                "donations",
                "legacyprojects",
                "pendingprojectroles",
                "pendingroundroles",
                "projectroles",
                "projects",
                "rounds",
                "roundroles",
                "eventsregistry",
            ];

            expect(types).toEqual(expect.arrayContaining(expectedTypes));

            // Verify unexpected types don't exist
            const unexpectedTypes = [
                "metadatacache",
                "pricecache",
                "processevents",
                "kyselymigration",
                "strategiesregistry",
            ];

            unexpectedTypes.forEach((type) => {
                expect(types).not.toContain(type);
            });

            // Verify searchProjects query exists
            const searchProjectsField = response.__schema.queryType.fields.find(
                (field) => field.name === "searchProjects",
            );
            expect(searchProjectsField).toBeDefined();
        });
    });
});
