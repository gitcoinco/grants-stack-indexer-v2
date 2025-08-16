import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    ILogger,
    NetworkError,
    NonRetriableError,
    RateLimitError,
    TimestampMs,
    TokenCode,
} from "@grants-stack-indexer/shared";

import type { TokenPrice } from "../../src/external.js";
import { CoinPaprikaProvider, UnsupportedToken } from "../../src/external.js";

// Mock axios
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("axios", async (importActual) => {
    const actual = await importActual<typeof import("axios")>();

    const mockAxios = {
        default: {
            ...actual.default,
            create: vi.fn(() => ({
                ...actual.default.create(),
                get: mockGet,
                post: mockPost,
            })),
        },
        isAxiosError: actual.isAxiosError, // Return it directly from the mock
    };

    return mockAxios;
});

// Mock current date for tier limit testing
const CURRENT_DATE = new Date("2023-01-01T00:00:00Z");

describe("CoinPaprikaProvider", () => {
    let provider: CoinPaprikaProvider;
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    beforeEach(() => {
        provider = new CoinPaprikaProvider(
            {
                apiKey: "test-api-key",
                apiType: "pro",
            },
            logger,
        );
        vi.spyOn(global.Date, "now").mockImplementation(() => CURRENT_DATE.getTime());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("getTokenPrice", () => {
        it("returns token price for a supported token", async () => {
            const mockResponse = [
                {
                    timestamp: "2023-01-01T00:00:00Z",
                    price: 1500,
                    volume_24h: 1000000,
                    market_cap: 10000000,
                },
            ];
            mockGet.mockResolvedValueOnce({ status: 200, data: mockResponse });

            const result = await provider.getTokenPrice(
                "ETH" as TokenCode,
                1672531200000 as TimestampMs, // 2023-01-01
                1672617600000 as TimestampMs, // 2023-01-02
            );

            const expectedPrice: TokenPrice = {
                timestampMs: 1672531200000 as TimestampMs,
                priceUsd: 1500,
            };

            expect(result).toEqual(expectedPrice);
            expect(mockGet).toHaveBeenCalledOnce();
        });

        it("returns undefined if no price data is available", async () => {
            mockGet.mockResolvedValueOnce({ status: 200, data: [] });

            const result = await provider.getTokenPrice(
                "ETH" as TokenCode,
                1672531200000 as TimestampMs,
                1672617600000 as TimestampMs,
            );

            expect(result).toBeUndefined();
        });

        it("returns undefined when endTimestamp is less than startTimestamp", async () => {
            const result = await provider.getTokenPrice(
                "ETH" as TokenCode,
                1672617600000 as TimestampMs, // later timestamp
                1672531200000 as TimestampMs, // earlier timestamp
            );

            expect(result).toBeUndefined();
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("throws UnsupportedToken for unsupported tokens", async () => {
            await expect(() =>
                provider.getTokenPrice(
                    "UNSUPPORTED" as TokenCode,
                    1672531200000 as TimestampMs,
                    1672617600000 as TimestampMs,
                ),
            ).rejects.toThrow(UnsupportedToken);
        });
    });

    describe("error handling", () => {
        it("handles rate limiting errors (429)", async () => {
            mockGet.mockRejectedValueOnce({
                status: 429,
                response: {
                    status: 429,
                    data: { error: "Too many requests" },
                },
                isAxiosError: true,
            });

            await expect(
                provider.getTokenPrice("ETH" as TokenCode, 1672531200000 as TimestampMs),
            ).rejects.toThrow(RateLimitError);
        });

        it("handles authentication errors (401)", async () => {
            mockGet.mockRejectedValueOnce({
                status: 401,
                response: {
                    status: 401,
                    data: { error: "Invalid API key" },
                },
                isAxiosError: true,
            });

            await expect(
                provider.getTokenPrice("ETH" as TokenCode, 1672531200000 as TimestampMs),
            ).rejects.toThrow(NonRetriableError);
        });

        it("handles network errors", async () => {
            mockGet.mockRejectedValueOnce({
                code: "ECONNABORTED",
                isAxiosError: true,
            });

            await expect(
                provider.getTokenPrice("ETH" as TokenCode, 1672531200000 as TimestampMs),
            ).rejects.toThrow(NetworkError);
        });
    });

    describe("getTokenPrices", () => {
        it("handles empty timestamps array", async () => {
            const result = await provider.getTokenPrices("ETH" as TokenCode, []);
            expect(result).toEqual([]);
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("throws UnsupportedToken for unknown token", async () => {
            await expect(
                provider.getTokenPrices("UNKNOWN" as TokenCode, [1672531200000 as TimestampMs]),
            ).rejects.toThrow(UnsupportedToken);
        });

        it("returns prices for valid timestamps", async () => {
            const mockResponse = [
                {
                    timestamp: "2023-01-01T00:00:00Z",
                    price: 1500,
                    volume_24h: 1000000,
                    market_cap: 10000000,
                },
                {
                    timestamp: "2023-01-02T00:00:00Z",
                    price: 1600,
                    volume_24h: 1100000,
                    market_cap: 11000000,
                },
            ];
            mockGet.mockResolvedValueOnce({ status: 200, data: mockResponse });

            const result = await provider.getTokenPrices("ETH" as TokenCode, [
                1672531200000 as TimestampMs, // 2023-01-01
                1672617600000 as TimestampMs, // 2023-01-02
            ]);

            expect(result).toHaveLength(2);
            expect(result[0]?.priceUsd).toBe(1500);
            expect(result[1]?.priceUsd).toBe(1600);
        });
    });
});
