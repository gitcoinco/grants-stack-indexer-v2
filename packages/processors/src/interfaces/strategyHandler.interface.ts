import type { Changeset } from "@grants-stack-indexer/repository";
import type {
    Address,
    ContractToEventName,
    ProcessorEvent,
    TimestampMs,
    Token,
} from "@grants-stack-indexer/shared";

import type { StrategyTimings } from "../internal.js";

/**
 * Interface for an event handler.
 * @template C - The contract name.
 * @template E - The event name.
 */
export interface IStrategyHandler<E extends ContractToEventName<"Strategy">> {
    /**
     * The name of the strategy.
     */
    name: string;

    /**
     * Handles the event.
     * @returns A promise that resolves to an array of changesets.
     */
    handle(event: ProcessorEvent<"Strategy", E>): Promise<Changeset[]>;

    /**
     * Fetch the strategy timings data from the strategy contract
     * @param strategyAddress - The address of the strategy
     * @returns The strategy timings
     */
    fetchStrategyTimings(strategyAddress: Address): Promise<StrategyTimings>;

    /**
     * Fetch the match amount for a strategy
     * @param matchingFundsAvailable - The matching funds available
     * @param token - The token
     * @param blockTimestamp - The block timestamp
     * @returns The match amount and match amount in USD
     */
    fetchMatchAmount(
        matchingFundsAvailable: number,
        token: Token,
        blockTimestamp: TimestampMs,
    ): Promise<{
        matchAmount: bigint;
        matchAmountInUsd: string;
    }>;
}
