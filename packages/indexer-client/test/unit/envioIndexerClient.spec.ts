import { GraphQLClient } from "graphql-request";
import { afterEach, beforeEach, describe, expect, it, Mocked, vi } from "vitest";

import { AnyIndexerFetchedEvent, ChainId } from "@grants-stack-indexer/shared";

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

    beforeEach(() => {
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
        const mockEvents: AnyIndexerFetchedEvent[] = [
            {
                chainId: 1,
                blockNumber: 12345,
                blockTimestamp: 123123123,
                contractName: "Allo",
                eventName: "PoolCreated",
                srcAddress: "0x1234567890123456789012345678901234567890",
                logIndex: 0,
                params: { contractAddress: "0x1234", tokenAddress: "0x1234", amount: 1000 },
                transactionFields: {
                    hash: "0x123",
                    transactionIndex: 1,
                },
            },
        ];

        it("returns events when the query is successful", async () => {
            const mockedResponse = {
                status: 200,
                headers: {},
                raw_events: mockEvents,
            };
            graphqlClient.request.mockResolvedValue(mockedResponse);

            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                12345,
                0,
                100,
            );
            expect(result).toEqual(mockEvents);
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
                raw_events: mockEvents,
            };
            graphqlClient.request.mockResolvedValue(mockedResponse);

            // Call the method without the limit argument
            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                12345,
                0,
            );

            expect(result).toEqual(mockEvents);
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
            const mockedResponse = {
                status: 200,
                headers: {},
                raw_events: [],
            };
            graphqlClient.request.mockResolvedValue(mockedResponse);

            const result = await envioIndexerClient.getEventsAfterBlockNumberAndLogIndex(
                1 as ChainId,
                12345,
                0,
            );
            expect(result).toEqual([]);
        });
    });
});
