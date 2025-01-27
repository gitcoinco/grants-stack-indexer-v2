import { Branded, TimestampMs } from "@grants-stack-indexer/shared";

export type CoingeckoSupportedChainId =
    | 1
    | 10
    | 100
    | 250
    | 42161
    | 43114
    | 713715
    | 1329
    | 42
    | 42220
    | 1088;

export type CoingeckoTokenId = Branded<string, "CoingeckoTokenId">;
export type CoingeckoPlatformId = Branded<string, "CoingeckoPlatformId">;

export type CoingeckoPriceChartData = {
    prices: [TimestampMs, number][];
    market_caps: [TimestampMs, number][];
    total_volumes: [TimestampMs, number][];
};
