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

import type {
    CoinPaprikaErrorResponse,
    CoinPaprikaHistoricalResponse,
    CoinPaprikaTokenId,
    IPricingProvider,
    TokenPrice,
} from "../internal.js";
import {
    NoClosePriceFound,
    UnknownPricingException,
    UnsupportedToken,
} from "../exceptions/index.js";

// CoinMarketCap API configuration
type CoinPaprikaOptions = {
    apiKey: string;
    apiType: "free" | "starter" | "pro" | "business" | "enterprise";
};

const TokenMapping: { [key: string]: CoinPaprikaTokenId | undefined } = {
    USDC: "usdc-usdc" as CoinPaprikaTokenId,
    DAI: "dai-dai" as CoinPaprikaTokenId,
    ETH: "eth-ethereum" as CoinPaprikaTokenId,
    eBTC: undefined,
    USDGLO: "usdglo-glo-dollar" as CoinPaprikaTokenId,
    // GIST: undefined,
    OP: "op-optimism" as CoinPaprikaTokenId,
    LYX: "lyx-lukso" as CoinPaprikaTokenId,
    WLYX: undefined,
    XDAI: "xdai-xdai" as CoinPaprikaTokenId,
    MATIC: "pol-polygon-ecosystem-token" as CoinPaprikaTokenId,
    DATA: "data-streamr-datacoin" as CoinPaprikaTokenId,
    FTM: "ftm-fantom" as CoinPaprikaTokenId, // this is Sonic because of migration
    // GcV: undefined,
    USDT: "usdt-tether" as CoinPaprikaTokenId,
    LUSD: "lusd-liquity-usd" as CoinPaprikaTokenId,
    MUTE: undefined,
    GTC: "gtc-gitcoin" as CoinPaprikaTokenId,
    METIS: "metis-metis-token" as CoinPaprikaTokenId,
    SEI: "sei-sei" as CoinPaprikaTokenId,
    ARB: "arb-arbitrum" as CoinPaprikaTokenId,
    CELO: "celo-celo" as CoinPaprikaTokenId,
    CUSD: "cusd-celo-dollar" as CoinPaprikaTokenId,
    AVAX: "avax-avalanche" as CoinPaprikaTokenId,
    // MTK: undefined,
    WSEI: undefined,
    HBAR: "hbar-hedera-hashgraph" as CoinPaprikaTokenId,
};

// Time delta for getTokenPrice
const TIME_DELTA = 2 * 60 * 60 * 1000; // 2 hours
const MAX_LIMIT = 5000;

// Tier limitations in days
type TierLimits = {
    daily: number; // in days
    hourly: number; // in days
    minutes: number; // in days
};

// Maps API tiers to their respective time limits (in days)
const TIER_LIMITS: Record<CoinPaprikaOptions["apiType"], TierLimits> = {
    free: {
        daily: 365, // 1 year
        hourly: 1, // 1 day
        minutes: 0, // none
    },
    starter: {
        daily: 365 * 5, // 5 years
        hourly: 30, // 30 days
        minutes: 7, // 7 days
    },
    pro: {
        daily: Infinity, // unlimited
        hourly: 90, // 90 days
        minutes: 30, // 30 days
    },
    business: {
        daily: Infinity, // unlimited
        hourly: 365, // 365 days
        minutes: 365, // 365 days
    },
    enterprise: {
        daily: Infinity, // unlimited
        hourly: Infinity, // unlimited
        minutes: Infinity, // unlimited
    },
};

/**
 * The CoinPaprika provider is a pricing provider that uses the CoinPaprika API to get the price of a token.
 * @see https://api.coinpaprika.com/#section/Introduction
 */
export class CoinPaprikaProvider implements IPricingProvider {
    private readonly axios: AxiosInstance;
    private readonly tierLimits: TierLimits;

    /**
     * @param options.apiKey - CoinPaprika API key.
     * @param options.apiType - CoinPaprika API tier type.
     * @param logger - Logger instance.
     */
    constructor(
        options: CoinPaprikaOptions,
        private readonly logger: ILogger,
    ) {
        const { apiKey, apiType } = options;
        this.tierLimits = TIER_LIMITS[apiType];

        this.axios = axios.create({
            baseURL: CoinPaprikaProvider.getBaseUrl(apiType),
            headers: {
                ...(apiType !== "free" ? { Authorization: apiKey } : {}),
                Accept: "application/json",
            },
        });
    }

    static getBaseUrl(apiType: CoinPaprikaOptions["apiType"]): string {
        switch (apiType) {
            case "free":
                return "https://api.coinpaprika.com/v1/";
            case "starter":
            case "pro":
            case "business":
            case "enterprise":
                return "https://pro-api.coinpaprika.com/v1/";
        }
    }

    /**
     * Determines the best interval to use based on timestamp range and tier limits
     * @param startTimestampMs - Start timestamp in milliseconds
     * @param endTimestampMs - End timestamp in milliseconds
     * @returns The best interval to use
     */
    private determineInterval(startTimestampMs: TimestampMs, endTimestampMs: TimestampMs): string {
        const now = Date.now();
        const rangeMs = endTimestampMs - startTimestampMs;
        const startAgeMs = now - startTimestampMs;

        // Convert to days for easier comparison with tier limits
        const rangeInDays = rangeMs / (24 * 60 * 60 * 1000);
        const startAgeInDays = startAgeMs / (24 * 60 * 60 * 1000);

        // If the data is recent enough, try to use minute-level granularity
        if (startAgeInDays <= this.tierLimits.minutes && rangeInDays <= 7) {
            return "15m";
        }

        // If the data is within hourly limits, use hourly granularity
        if (startAgeInDays <= this.tierLimits.hourly && rangeInDays <= 30) {
            return "1h";
        }

        // Fall back to daily granularity
        this.logger.debug("Using 1-day interval based on tier limits", {
            tierLimits: this.tierLimits,
            startAgeInDays,
            rangeInDays,
        });
        return "1d";
    }

    /**
     * Checks if a timestamp is within the limits of the current tier
     * @param timestamp - The timestamp to check
     * @param granularity - The granularity level ("minutes", "hourly", or "daily")
     * @returns true if the timestamp is within limits, false otherwise
     */
    private isTimestampWithinTierLimits(
        timestamp: TimestampMs,
        granularity: keyof TierLimits,
    ): boolean {
        const now = Date.now();
        const ageInMs = now - timestamp;
        const ageInDays = ageInMs / (24 * 60 * 60 * 1000);

        // Check if age exceeds the tier limit for the given granularity
        return ageInDays <= this.tierLimits[granularity];
    }

    /**
     * @inheritdoc
     * @see https://api.coinpaprika.com/#tag/Tickers/operation/getTickersHistoricalById
     */
    async getTokenPrice(
        tokenCode: TokenCode,
        startTimestampMs: TimestampMs,
        endTimestampMs?: TimestampMs,
    ): Promise<TokenPrice | undefined> {
        const tokenId = TokenMapping[tokenCode];
        if (!tokenId) {
            throw new UnsupportedToken(tokenCode, {
                className: CoinPaprikaProvider.name,
                methodName: "getTokenPrice",
            });
        }

        if (!endTimestampMs) {
            endTimestampMs = (startTimestampMs + TIME_DELTA) as TimestampMs;
        }

        if (startTimestampMs > endTimestampMs) {
            return undefined;
        }

        // Determine the best interval based on the request and tier limits
        const interval = this.determineInterval(startTimestampMs, endTimestampMs);

        // Check if the timestamp is within tier limits based on the determined interval
        let granularity: keyof TierLimits;
        if (interval.includes("m")) {
            granularity = "minutes";
        } else if (interval.includes("h")) {
            granularity = "hourly";
        } else {
            granularity = "daily";
        }

        if (!this.isTimestampWithinTierLimits(startTimestampMs, granularity)) {
            throw new NoClosePriceFound();
        }

        const startDate = startTimestampMs / 1000;
        const endDate = endTimestampMs / 1000;

        const prices = await this.getHistoricalPrices(tokenId, startDate, endDate, interval);
        if (prices.length === 0) {
            return undefined;
        }

        return prices.at(0);
    }

    /**
     * @inheritdoc
     * @see https://api.coinpaprika.com/#tag/Tickers/operation/getTickersHistoricalById
     */
    async getTokenPrices(tokenCode: TokenCode, timestamps: TimestampMs[]): Promise<TokenPrice[]> {
        if (timestamps.length === 0) {
            return [];
        }

        const tokenId = TokenMapping[tokenCode];
        if (!tokenId) {
            throw new UnsupportedToken(tokenCode, {
                className: CoinPaprikaProvider.name,
                methodName: "getTokenPrices",
            });
        }

        // Sort and find min/max timestamps
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
        const minTimestamp = sortedTimestamps[0]!;
        const maxTimestamp = sortedTimestamps[sortedTimestamps.length - 1]!;

        // Determine best interval based on timestamp range
        const interval = this.determineInterval(minTimestamp, maxTimestamp);

        // Determine granularity based on interval
        let granularity: keyof TierLimits;
        if (interval.includes("m")) {
            granularity = "minutes";
        } else if (interval.includes("h")) {
            granularity = "hourly";
        } else {
            granularity = "daily";
        }

        // Filter timestamps based on tier limits
        const validTimestamps = sortedTimestamps.filter((ts) =>
            this.isTimestampWithinTierLimits(ts, granularity),
        );

        if (validTimestamps.length === 0) {
            return [];
        }

        // Use the filtered timestamps for min/max
        const validMinTimestamp = validTimestamps[0]!;
        const validMaxTimestamp = validTimestamps[validTimestamps.length - 1]!;

        return this.getTokenPricesWithBatching(
            tokenId,
            validMinTimestamp,
            validMaxTimestamp,
            interval,
        );
    }

    /**
     * Get token prices using batching for large time ranges
     */
    private async getTokenPricesWithBatching(
        tokenId: CoinPaprikaTokenId,
        minTimestamp: TimestampMs,
        maxTimestamp: TimestampMs,
        interval: string,
    ): Promise<TokenPrice[]> {
        // Group into 90-day batches
        const BATCH_SIZE_DAYS = 90;
        const BATCH_SIZE_MS = BATCH_SIZE_DAYS * 24 * 60 * 60 * 1000;

        // Create batches
        const batches: { start: TimestampMs; end: TimestampMs }[] = [];
        let currentStart = minTimestamp;

        while (currentStart < maxTimestamp) {
            const batchEnd = Math.min(currentStart + BATCH_SIZE_MS, maxTimestamp) as TimestampMs;
            batches.push({
                start: currentStart,
                end: batchEnd,
            });
            currentStart = (batchEnd + 1) as TimestampMs;
        }

        // Process batches in parallel
        const batchResults = await Promise.all(
            batches.map(async (batch) => {
                const startDate = batch.start / 1000;
                const endDate = batch.end / 1000;

                return this.getHistoricalPrices(tokenId, startDate, endDate, interval);
            }),
        );

        // Flatten all batch results into a single array
        return batchResults.flat();
    }

    private async getHistoricalPrices(
        tokenId: CoinPaprikaTokenId,
        startDateSecs: number,
        endDateSecs: number,
        interval: string,
    ): Promise<TokenPrice[]> {
        const path = `/tickers/${tokenId}/historical`;
        const params = {
            start: startDateSecs,
            end: endDateSecs,
            interval,
            quote: "usd",
            limit: MAX_LIMIT,
        };

        try {
            const { data } = await this.axios.get<CoinPaprikaHistoricalResponse[]>(path, {
                params,
            });

            if (!data || data.length === 0) {
                return [];
            }

            return data.map((item) => ({
                timestampMs: new Date(item.timestamp).getTime() as TimestampMs,
                priceUsd: item.price,
            }));
        } catch (error) {
            if (isAxiosError<CoinPaprikaErrorResponse>(error)) {
                this.handleAxiosError(error, path, "getHistoricalPrices");
            }

            const errorMessage =
                `Unknown CoinPaprika API error: failed to fetch token price ` +
                stringify(error, Object.getOwnPropertyNames(error));

            throw new UnknownPricingException(errorMessage, {
                className: CoinPaprikaProvider.name,
                methodName: "getHistoricalPrices",
                additionalData: {
                    path,
                },
            });
        }
    }

    /**
     * Handle Axios errors from CoinPaprika API
     */
    private handleAxiosError(
        error: AxiosError<CoinPaprikaErrorResponse>,
        path: string,
        methodName: string,
    ): void {
        const errorContext = {
            className: CoinPaprikaProvider.name,
            methodName,
            additionalData: {
                path,
            },
        };

        const status = error.status!;
        const errorMsg = error.response?.data.error || error.message;

        // Handle rate limiting
        if (status === 429) {
            this.logger.debug("CoinPaprika API rate limit exceeded", {
                status,
                path,
            });

            throw new RateLimitError(errorContext);
        }

        // Handle auth errors
        if (status >= 400 && status < 500) {
            throw new NonRetriableError(
                `CoinPaprika API ${status} error: ${errorMsg}`,
                errorContext,
            );
        }

        // Handle server errors
        if (
            status >= 500 ||
            error.code === "ECONNABORTED" ||
            error.code === "ETIMEDOUT" ||
            error.code === "ENOTFOUND"
        ) {
            this.logger.error("CoinPaprika API server error", {
                status,
                path,
            });

            throw new NetworkError(
                errorContext,
                {
                    statusCode: status,
                    failureReason: errorMsg,
                },
                error,
            );
        }
    }
}
