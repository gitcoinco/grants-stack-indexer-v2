import { gql, GraphQLClient } from "graphql-request";

import { AnyIndexerFetchedEvent, ChainId } from "@grants-stack-indexer/shared";

import { IndexerClientError, InvalidIndexerResponse } from "../exceptions/index.js";
import { IIndexerClient } from "../internal.js";

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
                            where: {
                                chain_id: { _eq: $chainId }
                                block_number: { _gte: $blockNumber }
                                log_index: { _gt: $logIndex }
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
                throw new InvalidIndexerResponse(JSON.stringify(response));
            }
        } catch (error) {
            if (error instanceof InvalidIndexerResponse) {
                throw error;
            }
            throw new IndexerClientError(JSON.stringify(error));
        }
    }
}
