import axios, { AxiosError, AxiosInstance, isAxiosError } from "axios";

import {
    ILogger,
    NetworkError,
    NonRetriableError,
    RateLimitError,
    stringify,
    TokenCode,
} from "@grants-stack-indexer/shared";

import { IPricingProvider } from "../interfaces/index.js";
import {
    CoingeckoPriceChartData,
    CoingeckoTokenId,
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
    GIST: "dai" as CoingeckoTokenId,
    OP: "optimism" as CoingeckoTokenId,
    LYX: "lukso-token-2" as CoingeckoTokenId,
    WLYX: "wrapped-lyx-universalswaps" as CoingeckoTokenId,
    XDAI: "xdai" as CoingeckoTokenId,
    MATIC: "polygon-ecosystem-token" as CoingeckoTokenId,
    DATA: "streamr" as CoingeckoTokenId,
    FTM: "fantom" as CoingeckoTokenId,
    GcV: undefined,
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
    MTK: undefined,
    WSEI: "wrapped-sei" as CoingeckoTokenId,
};

// sometimes coingecko returns no prices for 1 hour range, 2 hours works better
const TIME_DELTA = 2 * 60 * 60 * 1000;

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
        startTimestampMs: number,
        endTimestampMs?: number,
    ): Promise<TokenPrice | undefined> {
        const tokenId = TokenMapping[tokenCode];
        if (!tokenId) {
            throw new UnsupportedToken(tokenCode, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrice",
            });
        }

        if (!endTimestampMs) {
            endTimestampMs = startTimestampMs + TIME_DELTA;
        }

        if (startTimestampMs > endTimestampMs) {
            return undefined;
        }

        const path = `/coins/${tokenId}/market_chart/range?vs_currency=usd&from=${startTimestampMs}&to=${endTimestampMs}&precision=full`;

        try {
            const { data } = await this.axios.get<CoingeckoPriceChartData>(path);

            const closestEntry = data.prices.at(0);
            if (!closestEntry) {
                return undefined;
            }

            return {
                timestampMs: closestEntry[0],
                priceUsd: closestEntry[1],
            };
        } catch (error: unknown) {
            if (isAxiosError(error)) {
                this.handleAxiosError(error, path);
            }

            const errorMessage =
                `Unknown Coingecko API error: failed to fetch token price ` +
                stringify(error, Object.getOwnPropertyNames(error));

            throw new UnknownPricingException(errorMessage, {
                className: CoingeckoProvider.name,
                methodName: "getTokenPrice",
                additionalData: {
                    path,
                },
            });
        }
    }

    private handleAxiosError(error: AxiosError, path: string): void {
        const errorContext = {
            className: CoingeckoProvider.name,
            methodName: "getTokenPrice",
            additionalData: {
                path,
            },
        };

        if (error.status! >= 400 && error.status! < 500) {
            if (error.status === 429) {
                throw new RateLimitError(
                    errorContext,
                    error.response?.headers["retry-after"] * 1000 || 60000,
                );
            } else {
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
