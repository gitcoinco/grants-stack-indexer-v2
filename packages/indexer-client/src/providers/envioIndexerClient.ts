import { gql, GraphQLClient } from "graphql-request";

import { AnyIndexerFetchedEvent, ChainId, stringify } from "@grants-stack-indexer/shared";

import { IndexerClientError, InvalidIndexerResponse } from "../exceptions/index.js";
import { GetEventsFilters, IIndexerClient } from "../internal.js";

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
    public async getEventsAfterBlockNumberAndLogIndex(
        chainId: ChainId,
        blockNumber: number,
        logIndex: number,
        limit: number = 100,
    ): Promise<AnyIndexerFetchedEvent[]> {
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
            if (response?.raw_events) {
                return response.raw_events;
            } else {
                throw new InvalidIndexerResponse(stringify(response));
            }
        } catch (error) {
            if (error instanceof InvalidIndexerResponse) {
                throw error;
            }
            throw new IndexerClientError(stringify(error, Object.getOwnPropertyNames(error)));
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
            if (error instanceof InvalidIndexerResponse) {
                throw error;
            }
            throw new IndexerClientError(stringify(error, Object.getOwnPropertyNames(error)));
        }
    }
}
