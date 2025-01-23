import { TimestampMs, TokenCode } from "@grants-stack-indexer/shared";

import { TokenPrice } from "../internal.js";

// available pricing providers
export type PricingProvider = "coingecko" | "dummy";

/**
 * Represents a pricing service that retrieves token prices.
 * @dev is service responsibility to map token code to their internal platform ID
 */
export interface IPricingProvider {
    /**
     * Retrieves the price of a token at a timestamp range.
     * @param tokenCode - The code of the token.
     * @param startTimestampMs - The start timestamp for which to retrieve the price.
     * @param endTimestampMs - The end timestamp for which to retrieve the price.
     * @returns A promise that resolves to the price of the token at the specified timestamp or undefined if no price is found.
     * @throws {UnsupportedToken} if the token is not supported by the pricing provider.
     * @throws {NetworkException} if the network is not reachable.
     * @throws {UnknownFetchException} if the pricing provider returns an unknown error.
     */
    getTokenPrice(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs?: TimestampMs,
    ): Promise<TokenPrice | undefined>;

    /**
     * Retrieves all the prices of a token for specific timestamps.
     * @param tokenCode - The code of the token.
     * @param timestamps - Array of timestamps for which to retrieve prices.
     * @returns A promise that resolves to the prices of the token for each requested timestamp.
     * The returned prices may not have the exact timestamps requested. Depends on the implementation.
     */
    getTokenPrices(tokenCode: TokenCode, timestamps: TimestampMs[]): Promise<TokenPrice[]>;
}
