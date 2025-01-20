import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NonRetriableError, RetriableError } from "../../src/internal.js";
import { ExponentialBackoff } from "../../src/retry/exponentialBackoff.strategy.js";
import { RetryHandler } from "../../src/retry/retry.js";

describe("RetryHandler", () => {
    let retriableError: RetriableError;
    const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    beforeEach(() => {
        retriableError = new RetriableError(
            "Temporary error",
            { className: "MyClass" },
            { retryAfterInMs: 5000 },
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("executes operation successfully on first try", async () => {
        const handler = new RetryHandler(new ExponentialBackoff(), mockLogger);
        const operation = vi.fn().mockResolvedValue("success");

        const result = await handler.execute(operation);

        expect(operation).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(result).toBe("success");
    });

    it("retries on RetriableError and succeeds", async () => {
        vi.useFakeTimers();
        const handler = new RetryHandler(new ExponentialBackoff(), mockLogger);
        const operation = vi
            .fn()
            .mockRejectedValueOnce(retriableError)
            .mockResolvedValueOnce("success");

        const promise = handler.execute(operation);

        // Fast-forward through the delay
        await vi.runAllTimersAsync();
        await promise;

        expect(operation).toHaveBeenCalledTimes(2);
        expect(mockLogger.debug).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it("throws non-RetriableError immediately", async () => {
        const handler = new RetryHandler(new ExponentialBackoff(), mockLogger);
        const error = new NonRetriableError("Non-retriable error", { className: "MyClass" });
        const operation = vi.fn().mockRejectedValue(error);

        await expect(handler.execute(operation)).rejects.toThrow(error);
        expect(operation).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it("throws error after max attempts", async () => {
        const strategy = new ExponentialBackoff({ maxAttempts: 2, baseDelay: 1, factor: 1 });
        const handler = new RetryHandler(strategy, mockLogger);
        const error = new RetriableError("Temporary error", { className: "MyClass" });
        const error2 = new RetriableError("Temporary error 2", { className: "MyClass" });
        const operation = vi
            .fn()
            .mockImplementation(() => {
                throw error;
            })
            .mockImplementation(() => {
                throw error2;
            });

        const promise = handler.execute(operation);

        await expect(promise).rejects.toThrow(error2);

        expect(operation).toHaveBeenCalledTimes(2);
    });
});
