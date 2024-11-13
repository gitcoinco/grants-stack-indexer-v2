import { IPricingProvider } from "@grants-stack-indexer/pricing";
import { Token } from "@grants-stack-indexer/shared";

import { TokenPriceNotFoundError } from "../internal.js";
import { calculateAmountInToken, calculateAmountInUsd } from "./index.js";

/**
 * Get the amount in USD for a given amount in the token
 * @param pricingProvider - The pricing provider to use
 * @param token - The token to get the amount in
 * @param amount - The amount in the token
 * @param timestamp - The timestamp to get the price at
 * @returns The amount in USD
 * @throws TokenPriceNotFoundError if the price is not found
 */
export const getTokenAmountInUsd = async (
    pricingProvider: IPricingProvider,
    token: Token,
    amount: bigint,
    timestamp: number,
    timestampEnd?: number,
): Promise<{ amountInUsd: string; timestamp: number }> => {
    const tokenPrice = await pricingProvider.getTokenPrice(
        token.priceSourceCode,
        timestamp,
        timestampEnd,
    );

    if (!tokenPrice) {
        throw new TokenPriceNotFoundError(token.address, timestamp);
    }

    return {
        amountInUsd: calculateAmountInUsd(amount, tokenPrice.priceUsd, token.decimals),
        timestamp: tokenPrice.timestampMs,
    };
};

/**
 * Get the amount in the token for a given amount in USD
 * @param pricingProvider - The pricing provider to use
 * @param token - The token to get the amount in
 * @param amountInUSD - The amount in USD
 * @param timestamp - The timestamp to get the price at
 * @returns The amount in the token
 * @throws TokenPriceNotFoundError if the price is not found
 */
export const getUsdInTokenAmount = async (
    pricingProvider: IPricingProvider,
    token: Token,
    amountInUSD: string,
    timestamp: number,
    timestampEnd?: number,
): Promise<{ amount: bigint; price: number; timestamp: Date }> => {
    const closestPrice = await pricingProvider.getTokenPrice(
        token.priceSourceCode,
        timestamp,
        timestampEnd,
    );

    if (!closestPrice) {
        throw new TokenPriceNotFoundError(token.address, timestamp);
    }

    return {
        amount: calculateAmountInToken(amountInUSD, closestPrice.priceUsd, token.decimals),
        timestamp: new Date(closestPrice.timestampMs),
        price: 1 / closestPrice.priceUsd, // price is the token price in USD, we return the inverse
    };
};
