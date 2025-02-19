import axios from "axios";
import { gql, GraphQLClient } from "graphql-request";
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import { TestEnvironment } from "../src/utils/test-environment.js";

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

/**
 * Test suite for the Processing Service integration
 */
describe("Processing Service Integration", () => {
    let testEnv: TestEnvironment;
    let apiGraphQLClient: GraphQLClient;
    let indexerGraphQLClient: GraphQLClient;

    /**
     * Setup test environment before all tests
     */
    beforeAll(async () => {
        testEnv = new TestEnvironment();
        await testEnv.setup();

        // Initialize GraphQL clients
        const hasuraApi = testEnv.getApiHasura();
        apiGraphQLClient = new GraphQLClient(hasuraApi.getGraphQlUrl());

        const indexerApi = testEnv.getIndexerGraphQl();
        indexerGraphQLClient = new GraphQLClient(indexerApi.getGraphQlUrl());

        // Stop the processing service to test without it running
        await testEnv.stopProcessingService();
    });

    /**
     * Cleanup test environment after all tests
     */
    afterAll(async () => {
        await testEnv.teardown();
    });

    /**
     * Tests for the Mock Indexer GraphQL Server
     */
    describe("Mock Indexer GraphQL Server", () => {
        it("returns block events", async () => {
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

        it("responds to health checks", async () => {
            const indexerApi = testEnv.getIndexerGraphQl();
            const healthResponse = await axios.get(`${indexerApi.getUrl()}/health`);

            expect(healthResponse.status).toBe(200);
            expect(healthResponse.data).toBe("OK");
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
            ];

            expect(types).toEqual(expect.arrayContaining(expectedTypes));

            // Verify unexpected types don't exist
            const unexpectedTypes = [
                "metadatacache",
                "pricecache",
                "processevents",
                "kyselymigration",
                "strategiesregistry",
                "eventsregistry",
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
