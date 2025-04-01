import axios, { AxiosError, AxiosInstance, isAxiosError } from "axios";

import {
    ILogger,
    NetworkError,
    NonRetriableError,
    RateLimitError,
    stringify,
    TimestampMs,
    TokenCode,
} from "@grants-stack-indexer/shared";

import { IPricingProvider } from "../interfaces/index.js";
import {
    CoingeckoPriceChartData,
    CoingeckoTokenId,
    MIN_GRANULARITY_MS,
    ninetyDaysMs,
    oneDayMs,
    TokenPrice,
    UnknownPricingException,
    UnsupportedToken,
} from "../internal.js";

type CoingeckoOptions = {
    apiKey: string;
    apiType: "demo" | "pro";
};

const getApiTypeConfig = (apiType: "demo" | "pro"): { baseURL: string; authHeader: string } =>
    apiType === "demo"
        ? { baseURL: "https://api.coingecko.com/api/v3", authHeader: "x-cg-demo-api-key" }
        : { baseURL: "https://pro-api.coingecko.com/api/v3/", authHeader: "x-cg-pro-api-key" };

const TokenMapping: { [key: string]: CoingeckoTokenId | undefined } = {
    USDC: "usd-coin" as CoingeckoTokenId,
    DAI: "dai" as CoingeckoTokenId,
    ETH: "ethereum" as CoingeckoTokenId,
    eBTC: "ebtc" as CoingeckoTokenId,
    USDGLO: "glo-dollar" as CoingeckoTokenId,
    // GIST: undefined,
    OP: "optimism" as CoingeckoTokenId,
    LYX: "lukso-token-2" as CoingeckoTokenId,
    WLYX: "wrapped-lyx-universalswaps" as CoingeckoTokenId,
    XDAI: "xdai" as CoingeckoTokenId,
    MATIC: "polygon-ecosystem-token" as CoingeckoTokenId,
    DATA: "streamr" as CoingeckoTokenId,
    FTM: "fantom" as CoingeckoTokenId,
    // GcV: undefined,
    USDT: "tether" as CoingeckoTokenId,
    LUSD: "liquity-usd" as CoingeckoTokenId,
    MUTE: "mute" as CoingeckoTokenId,
    GTC: "gitcoin" as CoingeckoTokenId,
    METIS: "metis" as CoingeckoTokenId,
    SEI: "sei-network" as CoingeckoTokenId,
    ARB: "arbitrum" as CoingeckoTokenId,
    CELO: "celo" as CoingeckoTokenId,
    CUSD: "celo-dollar" as CoingeckoTokenId,
    AVAX: "avalanche-2" as CoingeckoTokenId,
    // MTK: undefined,
    WSEI: "wrapped-sei" as CoingeckoTokenId,
    HBAR: "hedera-hashgraph" as CoingeckoTokenId,
    G$: "gooddollar" as CoingeckoTokenId,
};

// sometimes coingecko returns no prices for 1 hour range, 2 hours works better
const TIME_DELTA = 2 * 60 * 60 * 1000;

/**
 * Utility function to retry API calls with delay
 */
const withRetry = async <T>(
    operation: () => Promise<T>,
    retries = 3,
    delayMs = 3000,
    logger?: ILogger,
    context?: { tokenId?: string; method?: string },
): Promise<T> => {
    let lastError: Error = new Error("No error occurred");
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger?.debug(`Attempt ${attempt}/${retries} for CoinGecko API call`, {
                className: "CoingeckoProvider",
                method: context?.method,
                tokenId: context?.tokenId,
                attempt,
                retries,
            });
            return await operation();
        } catch (error) {
            lastError = error as Error;
            logger?.warn(`CoinGecko API call failed (attempt ${attempt}/${retries})`, {
                className: "CoingeckoProvider",
                method: context?.method,
                tokenId: context?.tokenId,
                error: error instanceof Error ? error.message : String(error),
                attempt,
                retries,
                willRetry: attempt < retries,
            });
            if (attempt === retries) break;
            logger?.debug(`Waiting ${delayMs}ms before retry`, {
                className: "CoingeckoProvider",
                method: context?.method,
                tokenId: context?.tokenId,
            });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    logger?.error(`All retry attempts failed for CoinGecko API call`, {
        className: "CoingeckoProvider",
        method: context?.method,
        tokenId: context?.tokenId,
        error: lastError instanceof Error ? lastError.message : String(lastError),
    });
    throw lastError;
};

/**
 * The Coingecko provider is a pricing provider that uses the Coingecko API to get the price of a token.
 */
export class CoingeckoProvider implements IPricingProvider {
    private readonly axios: AxiosInstance;

    /**
     * @param options.apiKey - Coingecko API key.
     * @param options.apiType - Coingecko API type (demo or pro).
     */
    constructor(
        options: CoingeckoOptions,
        private readonly logger: ILogger,
    ) {
        const { apiKey, apiType } = options;
        const { baseURL, authHeader } = getApiTypeConfig(apiType);

        this.axios = axios.create({
            baseURL,
            headers: {
                common: {
                    [authHeader]: apiKey,
                    Accept: "application/json",
                },
            },
        });
    }

    /* @inheritdoc */
    async getTokenPrice(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs?: TimestampMs,
    ): Promise<TokenPrice | undefined> {
        this.logger.debug(`Getting token price`, {
            className: CoingeckoProvider.name,
            methodName: "getTokenPrice",
            tokenCode,
            startTimestampMs: new Date(startTimestampMs).toISOString(),
            endTimestampMs: endTimestampMs ? new Date(endTimestampMs).toISOString() : undefined,
        });

        const tokenId = TokenMapping[tokenCode];
        if (!tokenId) {
            this.logger.warn(`Unsupported token ${tokenCode}`, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrice",
            });
            throw new UnsupportedToken(tokenCode, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrice",
            });
        }

        if (!endTimestampMs) {
            endTimestampMs = (startTimestampMs + TIME_DELTA) as TimestampMs;
        }

        if (startTimestampMs > endTimestampMs) {
            return undefined;
        }

        // Handle when the endTimestampMs is in the future
        const currentTimestamp = Date.now() - 60 * 1000;
        if (currentTimestamp < endTimestampMs) {
            startTimestampMs = (currentTimestamp - TIME_DELTA) as TimestampMs;
            endTimestampMs = currentTimestamp as TimestampMs;
        }

        const path = `/coins/${tokenId}/market_chart/range?vs_currency=usd&from=${startTimestampMs / 1000}&to=${endTimestampMs / 1000}&precision=full`;
        try {
            this.logger.debug(`Fetching price from CoinGecko`, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrice",
                tokenCode,
                path,
            });

            const { data } = await withRetry(
                () => this.axios.get<CoingeckoPriceChartData>(path),
                3,
                3000,
                this.logger,
                { tokenId, method: "getTokenPrice" },
            );

            const closestEntry = data.prices.at(0);
            if (!closestEntry) {
                this.logger.warn(`No price data returned from CoinGecko`, {
                    className: CoingeckoProvider.name,
                    methodName: "getTokenPrice",
                    tokenCode,
                    path,
                });
                return undefined;
            }

            this.logger.debug(`Successfully fetched price`, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrice",
                tokenCode,
                timestamp: new Date(closestEntry[0]).toISOString(),
                price: closestEntry[1],
            });

            return {
                timestampMs: closestEntry[0] as TimestampMs,
                priceUsd: closestEntry[1],
            };
        } catch (error: unknown) {
            if (isAxiosError(error)) {
                this.logger.error(`Axios error in price fetch`, {
                    className: CoingeckoProvider.name,
                    methodName: "getTokenPrice",
                    tokenCode,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    path,
                });
                this.handleAxiosError(error, path, "getTokenPrice");
            }

            const errorMessage =
                `Unknown Coingecko API error: failed to fetch token price ` +
                stringify(error, Object.getOwnPropertyNames(error));

            this.logger.error(errorMessage, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrice",
                tokenCode,
                path,
                error: error instanceof Error ? error.message : String(error),
            });

            throw new UnknownPricingException(errorMessage, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrice",
                additionalData: { path },
            });
        }
    }

    /* @inheritdoc */
    async getTokenPrices(tokenCode: TokenCode, timestamps: TimestampMs[]): Promise<TokenPrice[]> {
        this.logger.info(`Starting price fetch for token ${tokenCode}`, {
            className: CoingeckoProvider.name,
            methodName: "getTokenPrices",
            tokenCode,
            timestampCount: timestamps.length,
            timeRange:
                timestamps.length > 0
                    ? {
                          start: new Date(Math.min(...timestamps)).toISOString(),
                          end: new Date(Math.max(...timestamps)).toISOString(),
                      }
                    : undefined,
        });

        const tokenId = TokenMapping[tokenCode];
        if (!tokenId) {
            throw new UnsupportedToken(tokenCode, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrices",
            });
        }
        let path = "";
        try {
            if (timestamps.length === 0) {
                return [];
            }
            const effectiveMin = Math.min(...(timestamps as number[]));
            let effectiveMax = Math.max(...(timestamps as number[]));

            // 1 hour granularity
            const minGranularityMs = MIN_GRANULARITY_MS;

            if (effectiveMax - effectiveMin < minGranularityMs) {
                effectiveMax = effectiveMin + minGranularityMs;
            }

            // Log if the difference is greater than 90 days
            if (effectiveMax - effectiveMin > ninetyDaysMs) {
                const segments: Promise<TokenPrice[]>[] = [];
                const segmentDuration = 88 * oneDayMs; // 88 days in milliseconds
                let currentStart = effectiveMin;

                while (currentStart < effectiveMax) {
                    const currentEnd = Math.min(currentStart + segmentDuration, effectiveMax);

                    path = `/coins/${tokenId}/market_chart/range?vs_currency=usd&from=${Math.floor(currentStart / 1000)}&to=${Math.floor(currentEnd / 1000)}&precision=full`;
                    // Push the promise for the current segment
                    segments.push(
                        withRetry(() =>
                            this.axios.get<CoingeckoPriceChartData>(path).then(({ data }) =>
                                data.prices.map(([timestampMs, priceUsd]) => ({
                                    timestampMs,
                                    priceUsd,
                                })),
                            ),
                        ),
                    );

                    currentStart = currentEnd; // Move to the next segment
                }

                // Wait for all segments to resolve and merge the results
                const results = await Promise.all(segments);
                return results.flat(); // Flatten the array of results
            }
            path = `/coins/${tokenId}/market_chart/range?vs_currency=usd&from=${effectiveMin / 1000}&to=${effectiveMax / 1000}&precision=full`;
            const { data } = await withRetry(() => this.axios.get<CoingeckoPriceChartData>(path));
            return data.prices.map(([timestampMs, priceUsd]) => ({
                timestampMs,
                priceUsd,
            }));
        } catch (error: unknown) {
            if (isAxiosError(error)) {
                this.handleAxiosError(error, path, "getTokenPrices");
            }

            const errorMessage =
                `Unknown Coingecko API error: failed to fetch token price ` +
                stringify(error, Object.getOwnPropertyNames(error));

            throw new UnknownPricingException(errorMessage, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrices",
                additionalData: {
                    path,
                },
            });
        }
    }

    private handleAxiosError(error: AxiosError, path: string, methodName: string): void {
        this.logger.error(`Handling Axios error`, {
            className: CoingeckoProvider.name,
            methodName,
            status: error.status,
            message: error.message,
            path,
        });

        const errorContext = {
            className: CoingeckoProvider.name,
            methodName,
            additionalData: { path },
        };

        if (error.status! >= 400 && error.status! < 500) {
            if (error.status === 429) {
                const retryAfter = error.response?.headers["retry-after"] * 1000 || 60000;
                this.logger.warn(`Rate limit exceeded`, {
                    className: CoingeckoProvider.name,
                    methodName,
                    retryAfter: `${retryAfter / 1000} seconds`,
                });
                throw new RateLimitError(errorContext, retryAfter);
            } else {
                this.logger.error(`Non-retriable client error`, {
                    className: CoingeckoProvider.name,
                    methodName,
                    status: error.status,
                    code: error.code,
                });
                throw new NonRetriableError(
                    `${error.status} ${error.code} - Coingecko API error: failed to fetch token price`,
                    errorContext,
                    error,
                );
            }
        }

        if (error.status! > 10000) {
            throw new NonRetriableError(
                `${error.status} Coingecko API error: please check your credentials or consider upgrading your plan`,
                errorContext,
                error,
            );
        }

        if (error.status! >= 500 || error.message === "Network Error") {
            throw new NetworkError(errorContext, { statusCode: error.status }, error);
        }
    }
}
