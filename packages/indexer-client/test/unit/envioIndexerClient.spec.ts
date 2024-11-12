import { GraphQLClient, RequestDocument, RequestOptions } from "graphql-request";
import { afterEach, beforeEach, describe, expect, it, Mocked, vi } from "vitest";

import { AnyIndexerFetchedEvent, ChainId, PoolCreatedParams } from "@grants-stack-indexer/shared";

import { IndexerClientError, InvalidIndexerResponse } from "../../src/exceptions/index.js";
import { EnvioIndexerClient } from "../../src/providers/envioIndexerClient.js";

// Mock GraphQLClient
vi.mock("graphql-request", async (importOriginal) => {
    const mod: object = await importOriginal();
    return {
        ...mod,
        GraphQLClient: vi.fn().mockImplementation(() => ({
            setHeader: vi.fn(),
            request: vi.fn(),
        })),
    };
});

describe("EnvioIndexerClient", () => {
    let envioIndexerClient: EnvioIndexerClient;
    let graphqlClient: Mocked<GraphQLClient>;

    // Sample test data
    const testEvents: AnyIndexerFetchedEvent[] = [
        {
            chainId: 1,
            blockNumber: 100,
            blockTimestamp: 123123123,
            contractName: "Allo",
            eventName: "PoolCreated",
            srcAddress: "0x1234",
            logIndex: 1,
            params: {
                contractAddress: "0x1234",
                tokenAddress: "0x1234",
                amount: 1000n,
            } as unknown as PoolCreatedParams,
            transactionFields: { hash: "0x123", transactionIndex: 1 },
        },
        {
            chainId: 1,
            blockNumber: 100,
            blockTimestamp: 123123123,
            contractName: "Allo",
            eventName: "PoolCreated",
            srcAddress: "0x1234",
            logIndex: 3,
            params: {
                contractAddress: "0x1234",
                tokenAddress: "0x1234",
                amount: 1000n,
            } as unknown as PoolCreatedParams,
            transactionFields: { hash: "0x123", transactionIndex: 1 },
        },
        {
            chainId: 1,
            blockNumber: 101,
            blockTimestamp: 123123124,
            contractName: "Allo",
            eventName: "PoolCreated",
            srcAddress: "0x1234",
            logIndex: 1,
            params: {
                contractAddress: "0x1234",
                tokenAddress: "0x1234",
                amount: 1000n,
            } as unknown as PoolCreatedParams,
            transactionFields: { hash: "0x123", transactionIndex: 1 },
        },
        {
            chainId: 10,
            blockNumber: 1200,
            blockTimestamp: 123123123,
            contractName: "Allo",
            eventName: "PoolCreated",
            srcAddress: "0x1234",
            logIndex: 1,
            params: {
                contractAddress: "0x1234",
                tokenAddress: "0x1234",
                amount: 1000n,
            } as unknown as PoolCreatedParams,
            transactionFields: { hash: "0x123", transactionIndex: 1 },
        },
    ];

    beforeEach(() => {
        envioIndexerClient = new EnvioIndexerClient("http://example.com/graphql", "secret");
        graphqlClient = envioIndexerClient["client"] as unknown as Mocked<GraphQLClient>;

        // Mock the request implementation to simulate database querying
        graphqlClient.request.mockImplementation(
            async (
                _document: RequestDocument | RequestOptions<object, object>,
                ...args: object[]
            ) => {
                const variables = args[0] as {
                    chainId: ChainId;
                    blockNumber: number;
                    logIndex: number;
                    limit: number;
                };
                const { chainId, blockNumber, logIndex, limit } = variables;

                const filteredEvents = testEvents
                    .filter((event) => {
                        // Match chainId
                        if (event.chainId !== chainId) return false;

                        // Implement the _or condition from the GraphQL query
                        return (
                            event.blockNumber > blockNumber ||
                            (event.blockNumber === blockNumber && event.logIndex > logIndex)
                        );
                    })
                    .slice(0, limit); // Apply limit

                return { raw_events: filteredEvents };
            },
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("constructor", () => {
        it("creates a GraphQLClient with the provided URL", () => {
            expect(GraphQLClient).toHaveBeenCalledWith("http://example.com/graphql");
        });

        it("sets the x-hasura-admin-secret header", () => {
            expect(graphqlClient.setHeader).toHaveBeenCalledWith("x-hasura-admin-secret", "secret");
        });
    });

    describe("getEventsAfterBlockNumberAndLogIndex", () => {
        it("returns events after the specified block number", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                100,
                0,
                100,
            );

            expect(result).toHaveLength(3);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ blockNumber: 100, logIndex: 1 }),
                    expect.objectContaining({ blockNumber: 100, logIndex: 3 }),
                    expect.objectContaining({ blockNumber: 101, logIndex: 1 }),
                ]),
            );
        });

        it("returns only events after the specified log index within the same block", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                100,
                2,
                100,
            );

            expect(result).toHaveLength(2);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ blockNumber: 100, logIndex: 3 }),
                    expect.objectContaining({ blockNumber: 101, logIndex: 1 }),
                ]),
            );
        });

        it("respects the limit parameter", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                100,
                0,
                2,
            );

            expect(result).toHaveLength(2);
        });

        it("returns empty array when no matching events found", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                102,
                0,
                100,
            );

            expect(result).toHaveLength(0);
        });

        it("throws InvalidIndexerResponse when response structure is incorrect", async () => {
            const mockedResponse = {
                status: 200,
                headers: {},
                data: {
                    raw_events: undefined,
                },
            };
            graphqlClient.request.mockResolvedValue(mockedResponse);

            await expect(
                envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(1 as ChainId, 12345, 0),
            ).rejects.toThrow(InvalidIndexerResponse);
        });

        it("throws IndexerClientError when GraphQL request fails", async () => {
            const error = new Error("GraphQL request failed");
            graphqlClient.request.mockRejectedValue(error);

            await expect(
                envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(1 as ChainId, 12345, 0),
            ).rejects.toThrow(IndexerClientError);
        });

        it("uses the default limit value when limit is not provided", async () => {
            const mockedResponse = {
                status: 200,
                headers: {},
                raw_events: testEvents,
            };
            graphqlClient.request.mockResolvedValue(mockedResponse);

            // Call the method without the limit argument
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                12345,
                0,
            );

            expect(result).toEqual(testEvents);
            expect(graphqlClient.request).toHaveBeenCalledWith(
                expect.any(String), // We can check the query string later if necessary
                {
                    chainId: 1,
                    blockNumber: 12345,
                    logIndex: 0,
                    limit: 100, // Ensure the default limit is used
                },
            );
        });

        it("returns an empty array when no events are found", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                10_000,
                0,
            );
            expect(result).toEqual([]);
        });
    });
});
