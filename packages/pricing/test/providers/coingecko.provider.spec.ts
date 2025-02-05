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
import { CoingeckoProvider, UnsupportedToken } from "../../src/external.js";

const mock = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
}));

vi.mock("axios", async (importActual) => {
    const actual = await importActual<typeof import("axios")>();

    const mockAxios = {
        default: {
            ...actual.default,
            create: vi.fn(() => ({
                ...actual.default.create(),
                get: mock.get,
                post: mock.post,
            })),
        },
        isAxiosError: actual.isAxiosError, // Return it directly from the mock
    };

    return mockAxios;
});
describe("CoingeckoProvider", () => {
    let provider: CoingeckoProvider;
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    beforeEach(() => {
        provider = new CoingeckoProvider(
            {
                apiKey: "test-api-key",
                apiType: "demo",
            },
            logger,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("getTokenPrice", () => {
        it("return token price for a supported chain and valid token", async () => {
            const mockResponse = {
                prices: [[1609459200000, 100]],
            };
            mock.get.mockResolvedValueOnce({ status: 200, data: mockResponse });

            const result = await provider.getTokenPrice(
                "ETH" as TokenCode,
                1609459200000 as TimestampMs,
                1609545600000 as TimestampMs,
            );

            const expectedPrice: TokenPrice = {
                timestampMs: 1609459200000 as TimestampMs,
                priceUsd: 100,
            };

            expect(result).toEqual(expectedPrice);
            expect(mock.get).toHaveBeenCalledWith(
                "/coins/ethereum/market_chart/range?vs_currency=usd&from=1609459200000&to=1609545600000&precision=full",
            );
        });

        it("uses default endTimestampMs if not provided", async () => {
            const mockResponse = {
                prices: [[1609459200000, 100]],
            };
            mock.get.mockResolvedValueOnce({ status: 200, data: mockResponse });

            const result = await provider.getTokenPrice(
                "ETH" as TokenCode,
                1609459200000 as TimestampMs,
            );

            const expectedPrice: TokenPrice = {
                timestampMs: 1609459200000 as TimestampMs,
                priceUsd: 100,
            };

            expect(result).toEqual(expectedPrice);
            expect(mock.get).toHaveBeenCalledWith(
                "/coins/ethereum/market_chart/range?vs_currency=usd&from=1609459200000&to=1609466400000&precision=full",
            );
        });

        it("return undefined if no price data is available for timerange", async () => {
            const mockResponse = {
                prices: [],
            };
            mock.get.mockResolvedValueOnce({ status: 200, data: mockResponse });

            const result = await provider.getTokenPrice(
                "ETH" as TokenCode,
                1609459200000 as TimestampMs,
                1609545600000 as TimestampMs,
            );

            expect(result).toBeUndefined();
        });

        it("return undefined when endTimestamp is greater than startTimestamp", async () => {
            const result = await provider.getTokenPrice(
                "ETH" as TokenCode,
                1609545600000 as TimestampMs, // startTimestamp
                1609459200000 as TimestampMs, // endTimestamp
            );

            expect(result).toBeUndefined();
        });

        it("return RateLimitError if 429 error", async () => {
            mock.get.mockRejectedValueOnce({
                status: 429,
                data: "Rate limit exceeded",
                isAxiosError: true,
                headers: {
                    "retry-after": 60,
                },
            });

            await expect(
                provider.getTokenPrice(
                    "ETH" as TokenCode,
                    1609459200000 as TimestampMs,
                    1609545600000 as TimestampMs,
                ),
            ).rejects.toThrow(RateLimitError);
        });

        it("throw NonRetriableError for 400 family error", async () => {
            mock.get.mockRejectedValueOnce({
                status: 400,
                data: "Bad Request",
                isAxiosError: true,
            });

            await expect(
                provider.getTokenPrice(
                    "ETH" as TokenCode,
                    1609459200000 as TimestampMs,
                    1609545600000 as TimestampMs,
                ),
            ).rejects.toThrow(NonRetriableError);
        });

        it("throw UnsupportedTokenException for unsupported token", async () => {
            await expect(() =>
                provider.getTokenPrice(
                    "UNSUPPORTED" as TokenCode,
                    1609459200000 as TimestampMs,
                    1609545600000 as TimestampMs,
                ),
            ).rejects.toThrow(UnsupportedToken);
        });

        it("throws NetworkException for 500 family errors", async () => {
            mock.get.mockRejectedValueOnce({
                status: 500,
                data: "Internal Server Error",
                isAxiosError: true,
            });
            await expect(
                provider.getTokenPrice(
                    "ETH" as TokenCode,
                    1609459200000 as TimestampMs,
                    1609545600000 as TimestampMs,
                ),
            ).rejects.toThrow(NetworkError);
        });

        it("throw NetworkException for network errors", async () => {
            mock.get.mockRejectedValueOnce({
                status: 500,
                data: "Network Error",
                isAxiosError: true,
            });

            await expect(
                provider.getTokenPrice(
                    "ETH" as TokenCode,
                    1609459200000 as TimestampMs,
                    1609545600000 as TimestampMs,
                ),
            ).rejects.toThrow(NetworkError);
        });
    });

    describe("getTokenPrices", () => {
        it("handles empty timestamps array", async () => {
            const result = await provider.getTokenPrices("ETH" as TokenCode, []);
            expect(result).toEqual([]);
        });

        it("fetches prices within minimum granularity", async () => {
            const timestamps = [1000, 1100]; // Less than MIN_GRANULARITY_MS apart
            mock.get.mockResolvedValue({
                data: {
                    prices: [
                        [1000, 1500],
                        [1100, 1600],
                    ],
                },
            });

            await provider.getTokenPrices("ETH" as TokenCode, timestamps as TimestampMs[]);
            expect(mock.get).toHaveBeenCalledWith(expect.stringContaining(`&interval=5m`));
        });

        it("throws UnsupportedToken for unknown token", async () => {
            await expect(
                provider.getTokenPrices("UNKNOWN" as TokenCode, [1000 as TimestampMs]),
            ).rejects.toThrow(UnsupportedToken);
        });

        it("handles rate limiting errors", async () => {
            mock.get.mockRejectedValueOnce({
                status: 429,
                data: "Rate limit exceeded",
                isAxiosError: true,
                response: { headers: { "retry-after": "60" } },
            });

            await expect(
                provider.getTokenPrices("ETH" as TokenCode, [1000 as TimestampMs]),
            ).rejects.toThrow(RateLimitError);
        });
    });
});
