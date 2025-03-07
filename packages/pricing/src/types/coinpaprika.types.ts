import { Branded } from "@grants-stack-indexer/shared";

import { TimestampISO8601 } from "./index.js";

export type CoinPaprikaTokenId = Branded<string, "CoinPaprikaTokenId">;

// CoinPaprika API response types
export type CoinPaprikaHistoricalResponse = {
    timestamp: TimestampISO8601;
    price: number;
    volume_24h: number;
    market_cap: number;
};

export type CoinPaprikaErrorResponse = {
    error: string;
};
