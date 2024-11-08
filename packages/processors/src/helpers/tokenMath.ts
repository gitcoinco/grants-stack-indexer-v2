import { BigNumber } from "@grants-stack-indexer/shared";

import { InvalidArgument } from "../internal.js";

/**
 * Calculates the amount in USD
 * @param amount - The amount to convert to USD
 * @param tokenPrice - The price of the token in USD
 * @param tokenDecimals - The number of decimals the token has
 * @param truncateDecimals (optional) - The number of decimals to truncate the final result to. Must be between 0 and 18.
 * @throws InvalidArgumentException if truncateDecimals is not between 0 and 18
 * @returns The amount in USD
 */
export const calculateAmountInUsd = (
    amount: bigint,
    tokenPriceInUsd: string | number,
    tokenDecimals: number,
    truncateDecimals?: number,
): string => {
    const amountBN = new BigNumber(amount.toString());
    const tokenPriceBN = new BigNumber(tokenPriceInUsd.toString());
    const scaleFactor = new BigNumber(10).pow(tokenDecimals);

    let amountInUsd = amountBN.multipliedBy(tokenPriceBN).dividedBy(scaleFactor);

    if (truncateDecimals !== undefined) {
        if (truncateDecimals < 0 || truncateDecimals > 18) {
            throw new InvalidArgument("Truncate decimals must be between 0 and 18");
        }
        amountInUsd = amountInUsd.decimalPlaces(truncateDecimals);
    }

    return amountInUsd.toString();
};

/**
 * Calculates the amount in token
 * @param amountInUSD - The amount in USD
 * @param tokenPriceInUsd - The price of the token in USD
 * @param tokenDecimals - The number of decimals the token has
 * @returns The amount in token
 */
export const calculateAmountInToken = (
    amountInUSD: string,
    tokenPriceInUsd: string | number,
    tokenDecimals: number,
): bigint => {
    const amountInUsdBN = new BigNumber(amountInUSD);
    const tokenPriceInUsdBN = new BigNumber(tokenPriceInUsd);
    const scaleFactor = new BigNumber(10).pow(tokenDecimals);

    return BigInt(amountInUsdBN.multipliedBy(scaleFactor).dividedBy(tokenPriceInUsdBN).toFixed(0));
};
