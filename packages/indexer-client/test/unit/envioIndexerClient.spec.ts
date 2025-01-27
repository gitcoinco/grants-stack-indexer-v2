import { GraphQLClient, RequestDocument, RequestOptions } from "graphql-request";
import { afterEach, beforeEach, describe, expect, it, Mocked, vi } from "vitest";

import {
    Address,
    AnyIndexerFetchedEvent,
    ChainId,
    PoolCreatedParams,
} from "@grants-stack-indexer/shared";

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

type EnvioEvent = Omit<AnyIndexerFetchedEvent, "blockTimestamp"> & {
    blockTimestamp: number;
};

describe("EnvioIndexerClient", () => {
    let envioIndexerClient: EnvioIndexerClient;
    let graphqlClient: Mocked<GraphQLClient>;
    let testEvents: EnvioEvent[];

    beforeEach(() => {
        // Sample test data
        testEvents = [
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
                srcAddress: "0x3456",
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
        envioIndexerClient = new EnvioIndexerClient("http://example.com/graphql", "secret");
        graphqlClient = envioIndexerClient["client"] as unknown as Mocked<GraphQLClient>;
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

                    const filteredEvents = structuredClone(testEvents)
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

        it("returns events after the specified block number", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                chainId: 1 as ChainId,
                blockNumber: 100,
                logIndex: 0,
                limit: 100,
            });

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
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                chainId: 1 as ChainId,
                blockNumber: 100,
                logIndex: 2,
                limit: 100,
            });

            expect(result).toHaveLength(2);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ blockNumber: 100, logIndex: 3 }),
                    expect.objectContaining({ blockNumber: 101, logIndex: 1 }),
                ]),
            );
        });

        it("respects the limit parameter", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                chainId: 1 as ChainId,
                blockNumber: 100,
                logIndex: 0,
                limit: 2,
            });

            expect(result).toHaveLength(2);
        });

        it("returns empty array when no matching events found", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                chainId: 1 as ChainId,
                blockNumber: 102,
                logIndex: 0,
                limit: 100,
            });

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
                envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                    chainId: 1 as ChainId,
                    blockNumber: 12345,
                    logIndex: 0,
                    limit: 100,
                }),
            ).rejects.toThrow(InvalidIndexerResponse);
        });

        it("throws IndexerClientError when GraphQL request fails", async () => {
            const error = new Error("GraphQL request failed");
            graphqlClient.request.mockRejectedValue(error);

            await expect(
                envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                    chainId: 1 as ChainId,
                    blockNumber: 12345,
                    logIndex: 0,
                    limit: 100,
                }),
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
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                chainId: 1 as ChainId,
                blockNumber: 12345,
                logIndex: 0,
            });

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
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                chainId: 1 as ChainId,
                blockNumber: 10_000,
                logIndex: 0,
            });
            expect(result).toEqual([]);
        });

        it("discards events from the last block if allowPartialLastBlock is false", async () => {
            // Mock the request implementation to simulate database querying
            graphqlClient.request
                .mockImplementationOnce(
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

                        const filteredEvents = structuredClone(testEvents)
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
                )
                .mockResolvedValueOnce({
                    last_block_events: {
                        aggregate: { count: 5 },
                        nodes: [],
                    },
                });

            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                chainId: 1 as ChainId,
                blockNumber: 100,
                logIndex: 0,
                limit: 3,
                allowPartialLastBlock: false,
            });

            expect(result).toHaveLength(2);
            expect(result).toEqual(
                testEvents
                    .slice(0, 2)
                    .map((event) => ({ ...event, blockTimestamp: event.blockTimestamp * 1000 })),
            );
            expect(graphqlClient.request).toHaveBeenCalledTimes(2);
            expect(graphqlClient.request).toHaveBeenNthCalledWith(2, expect.any(String), {
                chainId: 1,
                blockNumber: 101,
            });
        });

        it("returns events with blockTimestamp in milliseconds", async () => {
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex({
                chainId: 1 as ChainId,
                blockNumber: 100,
                logIndex: 0,
                limit: 100,
            });
            expect(result).toHaveLength(3);
            expect(result[0]!.blockTimestamp).toBe(123123123000);
            expect(result[1]!.blockTimestamp).toBe(123123123000);
            expect(result[2]!.blockTimestamp).toBe(123123124000);
        });
    });

    describe("getEvents (old test cases)", () => {
        beforeEach(() => {
            envioIndexerClient = new EnvioIndexerClient("http://example.com/graphql", "secret");
            graphqlClient = envioIndexerClient["client"] as unknown as Mocked<GraphQLClient>;

            // Mock the request implementation to simulate database querying
            graphqlClient.request.mockImplementation(
                async (
                    _document: RequestDocument | RequestOptions<object, object>,
                    ...args: object[]
                ) => {
                    const filters = args[0] as {
                        chainId: ChainId;
                        limit: number;
                        srcAddresses?: Address[];
                        fromBlock?: number;
                        fromLogIndex?: number;
                        toBlock?: number;
                        toLogIndex?: number;
                    };
                    const { chainId, limit = 100, srcAddresses } = filters;
                    const { fromBlock, fromLogIndex, toBlock, toLogIndex } = filters;

                    const filteredEvents = structuredClone(testEvents)
                        .filter((event) => {
                            if (event.chainId !== chainId) return false;

                            if (srcAddresses && !srcAddresses.includes(event.srcAddress))
                                return false;

                            const isAfterFrom =
                                fromBlock !== undefined && fromLogIndex !== undefined
                                    ? event.blockNumber > fromBlock ||
                                      (event.blockNumber === fromBlock &&
                                          event.logIndex > fromLogIndex)
                                    : true;

                            const isBeforeTo =
                                toBlock !== undefined && toLogIndex !== undefined
                                    ? event.blockNumber < toBlock ||
                                      (event.blockNumber === toBlock &&
                                          event.logIndex <= toLogIndex)
                                    : true;

                            // Implement the _or condition from the GraphQL query
                            return isAfterFrom && isBeforeTo;
                        })
                        .slice(0, limit); // Apply limit

                    return { raw_events: filteredEvents };
                },
            );
        });

        it("returns events after the specified block number", async () => {
            const result = await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 100, logIndex: 0 },
                limit: 100,
            });

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
            const result = await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 100, logIndex: 2 },
                limit: 100,
            });

            expect(result).toHaveLength(2);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ blockNumber: 100, logIndex: 3 }),
                    expect.objectContaining({ blockNumber: 101, logIndex: 1 }),
                ]),
            );
        });

        it("returns events within the specified block range and matching srcAddresses", async () => {
            const result = await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                srcAddresses: ["0x1234"],
                from: { blockNumber: 100, logIndex: 0 },
            });

            expect(result).toHaveLength(2);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ blockNumber: 100, logIndex: 1 }),
                    expect.objectContaining({ blockNumber: 100, logIndex: 3 }),
                ]),
            );
        });

        it("returns events within the specified block range", async () => {
            const result = await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 100, logIndex: 5 },
                to: { blockNumber: 101, logIndex: 1 },
            });

            expect(result).toHaveLength(1);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ blockNumber: 101, logIndex: 1 }),
                ]),
            );
        });

        it("respects the limit parameter", async () => {
            const result = await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 100, logIndex: 0 },
                limit: 2,
            });

            expect(result).toHaveLength(2);
        });

        it("returns empty array when no matching events found", async () => {
            const result = await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 102, logIndex: 0 },
                limit: 100,
            });

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
                envioIndexerClient.getEvents({
                    chainId: 1 as ChainId,
                    from: { blockNumber: 12345, logIndex: 0 },
                    limit: 100,
                }),
            ).rejects.toThrow(InvalidIndexerResponse);
        });

        it("throws IndexerClientError when GraphQL request fails", async () => {
            const error = new Error("GraphQL request failed");
            graphqlClient.request.mockRejectedValue(error);

            await expect(
                envioIndexerClient.getEvents({
                    chainId: 1 as ChainId,
                    from: { blockNumber: 12345, logIndex: 0 },
                    limit: 100,
                }),
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
            const result = await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 12345, logIndex: 0 },
            });

            expect(result).toEqual(testEvents);
            expect(graphqlClient.request).toHaveBeenCalledWith(
                expect.any(String), // We can check the query string later if necessary
                {
                    chainId: 1,
                    srcAddresses: undefined,
                    fromBlock: 12345,
                    fromLogIndex: 0,
                    toBlock: undefined,
                    toLogIndex: undefined,
                    limit: 100, // Ensure the default limit is used
                },
            );
        });

        it("returns events with blockTimestamp in milliseconds", async () => {
            const result = await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 100, logIndex: 0 },
                limit: 100,
            });
            expect(result).toHaveLength(3);
            expect(result[0]!.blockTimestamp).toBe(123123123000);
            expect(result[1]!.blockTimestamp).toBe(123123123000);
            expect(result[2]!.blockTimestamp).toBe(123123124000);
        });
    });

    describe("where clause construction", () => {
        let queryString: string;
        let queryVars: Record<string, unknown>;

        beforeEach(() => {
            // Capture the query and variables for inspection
            graphqlClient.request.mockImplementation(
                async (
                    _document: RequestDocument | RequestOptions<object, object>,
                    ...args: object[]
                ) => {
                    queryString = _document.toString();
                    queryVars = args[0] as Record<string, unknown>;
                    return { raw_events: [] };
                },
            );
        });

        it("constructs basic where clause with only chainId", async () => {
            await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                limit: 100,
            });

            expect(queryString).toContain("where: { chain_id: { _eq: $chainId } }");
            expect(queryVars).toEqual({
                chainId: 1,
                limit: 100,
            });
        });

        it("constructs where clause with srcAddresses", async () => {
            await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                srcAddresses: ["0x1234", "0x5678"],
            });

            expect(queryString).toContain(
                "where: { _and: [{ chain_id: { _eq: $chainId } }, { src_address: { _in: $srcAddresses } }] }",
            );
            expect(queryVars).toEqual({
                chainId: 1,
                srcAddresses: ["0x1234", "0x5678"],
                limit: 100,
            });
        });

        it("constructs where clause with from conditions", async () => {
            await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 100, logIndex: 5 },
            });

            expect(queryString).toContain("_or: [");
            expect(queryString).toContain(`{ block_number: { _gt: $fromBlock } },`);
            expect(queryString).toContain(`{ _and: [`);
            expect(queryString).toContain(`{ block_number: { _eq: $fromBlock } },`);
            expect(queryString).toContain(`{ log_index: { _gt: $fromLogIndex } }`);
            expect(queryVars).toEqual({
                chainId: 1,
                fromBlock: 100,
                fromLogIndex: 5,
                limit: 100,
            });
        });

        it("constructs where clause with to conditions", async () => {
            await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                to: { blockNumber: 200, logIndex: 10 },
            });

            expect(queryString).toContain("block_number: { _lt: $toBlock }");
            expect(queryString).toContain("block_number: { _eq: $toBlock }");
            expect(queryString).toContain("log_index: { _lte: $toLogIndex }");
            expect(queryVars).toEqual({
                chainId: 1,
                toBlock: 200,
                toLogIndex: 10,
                limit: 100,
            });
        });

        it("constructs complete where clause with all conditions", async () => {
            await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                srcAddresses: ["0x1234"],
                from: { blockNumber: 100, logIndex: 5 },
                to: { blockNumber: 200, logIndex: 10 },
                limit: 50,
            });

            // Check that all conditions are present
            expect(queryString).toContain("chain_id: { _eq: $chainId }");
            expect(queryString).toContain("src_address: { _in: $srcAddresses }");
            expect(queryString).toContain("block_number: { _gt: $fromBlock }");
            expect(queryString).toContain("block_number: { _lt: $toBlock }");

            // Check variables
            expect(queryVars).toEqual({
                chainId: 1,
                srcAddresses: ["0x1234"],
                fromBlock: 100,
                fromLogIndex: 5,
                toBlock: 200,
                toLogIndex: 10,
                limit: 50,
            });
        });

        it("properly formats the query with whitespace and newlines", async () => {
            await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                from: { blockNumber: 100, logIndex: 5 },
            });

            // Remove all whitespace to make comparison easier
            const normalizedQuery = queryString.replace(/\s+/g, " ").trim();

            // Check that the query is properly formatted
            expect(normalizedQuery).toContain(
                "where: { _and: [{ chain_id: { _eq: $chainId } }, { _or: [",
            );
            expect(normalizedQuery).not.toContain(",,"); // No double commas
            expect(normalizedQuery).not.toContain("{{"); // No double braces
            expect(normalizedQuery).not.toContain("}}"); // No double braces
        });

        it("handles empty optional parameters", async () => {
            await envioIndexerClient.getEvents({
                chainId: 1 as ChainId,
                srcAddresses: [], // Empty array
            });

            expect(queryString).toContain("where: { chain_id: { _eq: $chainId } }");
            expect(queryVars).not.toHaveProperty("srcAddresses");
        });
    });
});
