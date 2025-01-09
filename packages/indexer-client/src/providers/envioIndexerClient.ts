import { gql, GraphQLClient } from "graphql-request";

import { AnyIndexerFetchedEvent, ChainId, stringify } from "@grants-stack-indexer/shared";

import { IndexerClientError, InvalidIndexerResponse } from "../exceptions/index.js";
import {
    GetEventsAfterBlockNumberAndLogIndexParams,
    GetEventsFilters,
    IIndexerClient,
} from "../internal.js";

/**
 * Indexer client for the Envio indexer service
 */
export class EnvioIndexerClient implements IIndexerClient {
    private client: GraphQLClient;

    constructor(url: string, secret: string) {
        this.client = new GraphQLClient(url);
        this.client.setHeader("x-hasura-admin-secret", secret);
    }
    /* @inheritdoc */
    public async getEventsAfterBlockNumberAndLogIndex({
        chainId,
        blockNumber,
        logIndex,
        limit = 100,
        lastBlockComplete = false,
    }: GetEventsAfterBlockNumberAndLogIndexParams): Promise<AnyIndexerFetchedEvent[]> {
        try {
            const response = (await this.client.request(
                gql`
                    query getEventsAfterBlockNumberAndLogIndex(
                        $chainId: Int!
                        $blockNumber: Int!
                        $logIndex: Int!
                        $limit: Int!
                    ) {
                        raw_events(
                            order_by: [{ block_number: asc }, { log_index: asc }]
                            where: {
                                chain_id: { _eq: $chainId }
                                _or: [
                                    { block_number: { _gt: $blockNumber } }
                                    {
                                        _and: [
                                            { block_number: { _eq: $blockNumber } }
                                            { log_index: { _gt: $logIndex } }
                                        ]
                                    }
                                ]
                            }
                            limit: $limit
                        ) {
                            blockNumber: block_number
                            blockTimestamp: block_timestamp
                            chainId: chain_id
                            contractName: contract_name
                            eventName: event_name
                            logIndex: log_index
                            params
                            srcAddress: src_address
                            transactionFields: transaction_fields
                        }
                    }
                `,
                { chainId, blockNumber, logIndex, limit },
            )) as { raw_events: AnyIndexerFetchedEvent[] };
            const events = response?.raw_events;

            if (events) {
                if (!lastBlockComplete || events.length === 0) {
                    return events;
                } else {
                    const lastBlockNumber = events[events.length - 1]!.blockNumber;
                    const countLastBlockEvents = events.filter(
                        (e) => e.blockNumber === lastBlockNumber,
                    ).length;
                    const { lastBlockEvents } = await this.getTotalEventsInBlock(
                        chainId,
                        lastBlockNumber,
                    );

                    // If the last event's block has more events than what we fetched,
                    // we need to exclude that block's events
                    return lastBlockEvents.aggregate.count > countLastBlockEvents
                        ? events.filter((e) => e.blockNumber < lastBlockNumber)
                        : events;
                }
            } else {
                throw new InvalidIndexerResponse(stringify(response));
            }
        } catch (error) {
            throw this.handleError(error, "getEventsAfterBlockNumberAndLogIndex");
        }
    }

    /**
     * Get the total number of events in a block
     * @param chainId - The chain ID
     * @param blockNumber - The block number
     * @returns The total number of events in the block
     */
    private async getTotalEventsInBlock(
        chainId: ChainId,
        blockNumber: number,
    ): Promise<{
        lastBlockEvents: {
            aggregate: { count: number };
            nodes: { block_number: number }[];
        };
    }> {
        try {
            const response = (await this.client.request(
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
                { chainId, blockNumber },
            )) as {
                last_block_events: {
                    aggregate: { count: number };
                    nodes: { block_number: number }[];
                };
            };

            return {
                lastBlockEvents: response.last_block_events,
            };
        } catch (error) {
            throw this.handleError(error, "getTotalEventsInBlock");
        }
    }

    /** @inheritdoc */
    async getEvents(params: GetEventsFilters): Promise<AnyIndexerFetchedEvent[]> {
        try {
            const { chainId, srcAddresses, from, to, limit = 100 } = params;

            // Build the _and conditions array
            const andConditions = [];
            andConditions.push(`chain_id: { _eq: $chainId }`);
            const vars: Record<string, unknown> = { chainId };

            // Add srcAddresses filter if provided
            if (srcAddresses && srcAddresses.length > 0) {
                andConditions.push(`src_address: { _in: $srcAddresses }`);
                vars["srcAddresses"] = srcAddresses;
            }

            if (from != undefined && from != null) {
                andConditions.push(`
                    _or: [
                        { block_number: { _gt: $fromBlock } },
                        {
                            _and: [
                                { block_number: { _eq: $fromBlock } },
                                { log_index: { _gt: $fromLogIndex } }
                            ]
                        }
                    ]
                `);
                vars["fromBlock"] = from.blockNumber;
                vars["fromLogIndex"] = from.logIndex;
            }

            if (to != undefined && to != null) {
                andConditions.push(`
                    _or: [
                        { block_number: { _lt: $toBlock } },
                        {
                            _and: [
                                { block_number: { _eq: $toBlock } },
                                { log_index: { _lte: $toLogIndex } }
                            ]
                        }
                    ]
                `);
                vars["toBlock"] = to.blockNumber;
                vars["toLogIndex"] = to.logIndex;
            }

            const whereClause =
                andConditions.length > 1
                    ? `_and: [{ ${andConditions.join(" }, { ")} }]`
                    : andConditions[0];

            const response = (await this.client.request(
                gql`
                    query getEvents(
                        $chainId: Int!
                        $srcAddresses: [String!]
                        $fromBlock: Int
                        $fromLogIndex: Int
                        $toBlock: Int
                        $toLogIndex: Int
                        $limit: Int!
                    ) {
                        raw_events(
                            order_by: [{ block_number: asc }, { log_index: asc }]
                            where: { ${whereClause} }
                            limit: $limit
                        ) {
                            blockNumber: block_number
                            blockTimestamp: block_timestamp
                            chainId: chain_id
                            contractName: contract_name
                            eventName: event_name
                            logIndex: log_index
                            params
                            srcAddress: src_address
                            transactionFields: transaction_fields
                        }
                    }
                `,
                {
                    ...vars,
                    limit,
                },
            )) as { raw_events: AnyIndexerFetchedEvent[] };

            if (response?.raw_events) {
                return response.raw_events;
            } else {
                throw new InvalidIndexerResponse(stringify(response));
            }
        } catch (error) {
            throw this.handleError(error, "getEvents");
        }
    }

    private handleError(error: unknown, methodName: string): Error {
        if (error instanceof InvalidIndexerResponse) {
            return error;
        }
        return new IndexerClientError(stringify(error, Object.getOwnPropertyNames(error)), {
            className: EnvioIndexerClient.name,
            methodName,
        });
    }
}
