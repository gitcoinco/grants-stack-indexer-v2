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

    describe("getEventsBySrcAddress", () => {
        beforeEach(() => {
            // Update the mock implementation for getEventsBySrcAddress queries
            graphqlClient.request.mockImplementation(
                async (
                    _document: RequestDocument | RequestOptions<object, object>,
                    ...args: object[]
                ) => {
                    const variables = args[0] as {
                        chainId: ChainId;
                        srcAddresses: string[];
                        fromBlock: number;
                        fromLogIndex: number;
                        toBlock: number;
                        toLogIndex: number;
                        limit: number;
                    };
                    const {
                        chainId,
                        srcAddresses,
                        fromBlock,
                        fromLogIndex,
                        toBlock,
                        toLogIndex,
                        limit,
                    } = variables;

                    const filteredEvents = testEvents
                        .filter((event) => {
                            // Match chainId and srcAddress
                            if (event.chainId !== chainId) return false;
                            if (!srcAddresses.includes(event.srcAddress)) return false;

                            // Check if event is after fromBlock/fromLogIndex
                            const isAfterFrom =
                                event.blockNumber > fromBlock ||
                                (event.blockNumber === fromBlock && event.logIndex > fromLogIndex);

                            // Check if event is before or at toBlock/toLogIndex
                            const isBeforeTo =
                                event.blockNumber < toBlock ||
                                (event.blockNumber === toBlock && event.logIndex <= toLogIndex);

                            return isAfterFrom && isBeforeTo;
                        })
                        .slice(0, limit);

                    return { raw_events: filteredEvents };
                },
            );
        });

        it("returns events within the specified block range and matching srcAddresses", async () => {
            const result = await envioIndexerClient.getEventsBySrcAddress({
                chainId: 1 as ChainId,
                srcAddresses: ["0x1234"],
                from: { blockNumber: 100, logIndex: 0 },
                to: { blockNumber: 101, logIndex: 2 },
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

        it("uses default from values when not provided", async () => {
            const result = await envioIndexerClient.getEventsBySrcAddress({
                chainId: 1 as ChainId,
                srcAddresses: ["0x1234"],
                to: { blockNumber: 101, logIndex: 2 },
            });

            expect(result).toHaveLength(3);
            // Should include all events up to block 101, logIndex 2
            expect(result[0]?.blockNumber).toBe(100);
            expect(result[2]?.blockNumber).toBe(101);
        });

        it("respects the limit parameter", async () => {
            const result = await envioIndexerClient.getEventsBySrcAddress({
                chainId: 1 as ChainId,
                srcAddresses: ["0x1234"],
                to: { blockNumber: 101, logIndex: 2 },
                limit: 2,
            });

            expect(result).toHaveLength(2);
        });

        it("uses default limit when not provided", async () => {
            await envioIndexerClient.getEventsBySrcAddress({
                chainId: 1 as ChainId,
                srcAddresses: ["0x1234"],
                to: { blockNumber: 101, logIndex: 2 },
            });

            expect(graphqlClient.request).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ limit: 100 }),
            );
        });

        it("returns empty array when no events match srcAddresses", async () => {
            const result = await envioIndexerClient.getEventsBySrcAddress({
                chainId: 1 as ChainId,
                srcAddresses: ["0x9999"],
                to: { blockNumber: 101, logIndex: 2 },
            });

            expect(result).toHaveLength(0);
        });

        it("throws InvalidIndexerResponse when response structure is incorrect", async () => {
            graphqlClient.request.mockResolvedValue({ status: 200, headers: {}, data: {} });

            await expect(
                envioIndexerClient.getEventsBySrcAddress({
                    chainId: 1 as ChainId,
                    srcAddresses: ["0x1234"],
                    to: { blockNumber: 101, logIndex: 2 },
                }),
            ).rejects.toThrow(InvalidIndexerResponse);
        });

        it("throws IndexerClientError when GraphQL request fails", async () => {
            graphqlClient.request.mockRejectedValue(new Error("GraphQL request failed"));

            await expect(
                envioIndexerClient.getEventsBySrcAddress({
                    chainId: 1 as ChainId,
                    srcAddresses: ["0x1234"],
                    to: { blockNumber: 101, logIndex: 2 },
                }),
            ).rejects.toThrow(IndexerClientError);
        });

        it("filters events by multiple srcAddresses", async () => {
            // Add a test event with a different srcAddress
            const extraTestEvent = {
                ...testEvents[0],
                srcAddress: "0x5678",
                blockNumber: 100,
                logIndex: 2,
            } as AnyIndexerFetchedEvent;
            testEvents.push(extraTestEvent);

            const result = await envioIndexerClient.getEventsBySrcAddress({
                chainId: 1 as ChainId,
                srcAddresses: ["0x1234", "0x5678"],
                from: { blockNumber: 100, logIndex: 0 },
                to: { blockNumber: 101, logIndex: 2 },
            });

            expect(result).toContainEqual(expect.objectContaining({ srcAddress: "0x5678" }));
            expect(result).toContainEqual(expect.objectContaining({ srcAddress: "0x1234" }));
        });
    });
});
