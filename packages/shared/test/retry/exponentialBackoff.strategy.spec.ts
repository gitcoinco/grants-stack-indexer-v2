import { describe, expect, it, vi } from "vitest";

import { ExponentialBackoff } from "../../src/retry/exponentialBackoff.strategy.js";

describe("ExponentialBackoff", () => {
    describe("constructor", () => {
        it("uses default options when none provided", () => {
            const strategy = new ExponentialBackoff();
            expect(strategy["options"].baseDelay).toBe(200);
            expect(strategy["options"].factor).toBe(1.5);
            expect(strategy["options"].maxAttempts).toBe(10);
        });

        it("applies provided options", () => {
            const strategy = new ExponentialBackoff({
                baseDelay: 1000,
                factor: 3,
                maxAttempts: 5,
                maxDelay: 10000,
            });
            expect(strategy["options"].baseDelay).toBe(1000);
            expect(strategy["options"].factor).toBe(3);
            expect(strategy["options"].maxAttempts).toBe(5);
            expect(strategy["options"].maxDelay).toBe(10000);
        });
    });

    describe("getDelay", () => {
        it("calculates exponential delay correctly", () => {
            const strategy = new ExponentialBackoff({
                baseDelay: 1000,
                factor: 2,
                maxAttempts: 3,
            });

            // Mock Math.random to return 0.5 for consistent jitter testing
            vi.spyOn(Math, "random").mockReturnValue(0.5);

            // With jitter factor of 1.0 (0.8 + 0.5 * 0.4):
            // Attempt 1: 1000 * (2^1) * 1.0 = 2000
            // Attempt 2: 1000 * (2^2) * 1.0 = 4000
            expect(strategy.getDelay(1)).toBe(2000);
            expect(strategy.getDelay(2)).toBe(4000);
        });

        it("respects maxDelay cap", () => {
            const strategy = new ExponentialBackoff({
                baseDelay: 1000,
                factor: 2,
                maxAttempts: 3,
                maxDelay: 3000,
            });

            vi.spyOn(Math, "random").mockReturnValue(0.5);

            // Should be capped at 3000 even though calculation would be 4000
            expect(strategy.getDelay(2)).toBe(3000);
        });

        it("uses retryAfter when larger than calculated delay", () => {
            const strategy = new ExponentialBackoff({
                baseDelay: 1000,
                factor: 2,
                maxAttempts: 3,
            });

            vi.spyOn(Math, "random").mockReturnValue(0.5);

            // Calculated delay would be 2000, but retryAfter is 3000
            expect(strategy.getDelay(1, 3000)).toBe(3000);
        });

        it("adds jitter within expected range", () => {
            const strategy = new ExponentialBackoff({
                baseDelay: 1000,
                factor: 2,
                maxAttempts: 3,
            });

            const delay = strategy.getDelay(1); // Base delay would be 2000
            expect(delay).toBeGreaterThanOrEqual(1600); // 2000 * 0.8
            expect(delay).toBeLessThanOrEqual(2400); // 2000 * 1.2
        });
    });

    describe("shouldRetry", () => {
        it("returns true when attempt count is below max attempts", () => {
            const strategy = new ExponentialBackoff({
                baseDelay: 1000,
                factor: 2,
                maxAttempts: 3,
            });
            expect(strategy.shouldRetry(0)).toBe(true);
            expect(strategy.shouldRetry(1)).toBe(true);
            expect(strategy.shouldRetry(2)).toBe(true);
        });

        it("returns false when attempt count reaches or exceeds max attempts", () => {
            const strategy = new ExponentialBackoff({
                baseDelay: 1000,
                factor: 2,
                maxAttempts: 3,
            });
            expect(strategy.shouldRetry(3)).toBe(false);
            expect(strategy.shouldRetry(4)).toBe(false);
        });
    });
});
