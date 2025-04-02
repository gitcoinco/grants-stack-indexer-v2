import { ILogger, RetriableError } from "../internal.js";
import { ExponentialBackoff, RetryStrategy } from "./index.js";

/**
 * Handles retrying operations with configurable retry strategies.
 * Supports exponential backoff and other retry patterns through the RetryStrategy interface.
 */
export class RetryHandler {
    /**
     * Creates a new RetryHandler instance
     * @param strategy - The retry strategy to use, defaults to ExponentialBackoff
     * @param logger - Logger instance for debug messages
     */
    constructor(
        private readonly strategy: RetryStrategy = new ExponentialBackoff(),
        private readonly logger: ILogger,
    ) {
        this.logger.debug("Initializing RetryHandler", {
            className: "RetryHandler",
            strategyType: strategy.constructor.name,
        });
    }

    /**
     * Executes an operation with retry logic
     * @param operation - Async operation to execute and potentially retry
     * @param params - Optional parameters
     * @param params.abortSignal - Optional AbortSignal to cancel retries
     * @returns Promise that resolves when operation succeeds or max retries exceeded
     * @throws RetriableError if max retries exceeded
     * @throws Error if operation aborted or non-retriable error occurs
     */
    async execute<T>(
        operation: () => Promise<T>,
        params: { abortSignal?: AbortSignal } = {},
    ): Promise<T | undefined> {
        this.logger.debug("Starting operation execution", {
            className: "RetryHandler",
            methodName: "execute",
            hasAbortSignal: !!params.abortSignal,
        });

        let result: T | undefined;
        let attemptCount = 0;
        const startTime = Date.now();

        while (true && !params.abortSignal?.aborted) {
            attemptCount++;

            this.logger.debug("Attempting operation", {
                className: "RetryHandler",
                methodName: "execute",
                attemptCount,
                elapsedMs: Date.now() - startTime,
            });

            try {
                result = await operation();
                const duration = Date.now() - startTime;

                this.logger.info("Operation completed successfully", {
                    className: "RetryHandler",
                    methodName: "execute",
                    attemptCount,
                    durationMs: duration,
                    hasResult: result !== undefined,
                });

                break;
            } catch (error) {
                const isRetriable = error instanceof RetriableError;

                this.logger.warn("Operation attempt failed", {
                    className: "RetryHandler",
                    methodName: "execute",
                    attemptCount,
                    isRetriable,
                    error: error instanceof Error ? error.message : String(error),
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                    metadata: error instanceof RetriableError ? error.metadata : undefined,
                });

                if (!isRetriable) {
                    this.logger.error("Non-retriable error encountered", {
                        className: "RetryHandler",
                        methodName: "execute",
                        attemptCount,
                        error: error instanceof Error ? error.message : String(error),
                        elapsedMs: Date.now() - startTime,
                    });
                    throw error;
                }

                if (!this.strategy.shouldRetry(attemptCount)) {
                    this.logger.error("Max retries exceeded", {
                        className: "RetryHandler",
                        methodName: "execute",
                        attemptCount,
                        elapsedMs: Date.now() - startTime,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    throw error;
                }

                const delay = this.strategy.getDelay(
                    attemptCount,
                    error instanceof RetriableError ? error.metadata?.retryAfterInMs : undefined,
                );

                this.logger.debug("Scheduling retry", {
                    className: "RetryHandler",
                    methodName: "execute",
                    attemptCount,
                    nextDelayMs: delay,
                    elapsedMs: Date.now() - startTime,
                    retryAfterMs:
                        error instanceof RetriableError
                            ? error.metadata?.retryAfterInMs
                            : undefined,
                });

                await new Promise((resolve) => setTimeout(resolve, delay, params.abortSignal));
            }
        }

        if (params.abortSignal?.aborted) {
            this.logger.warn("Operation aborted", {
                className: "RetryHandler",
                methodName: "execute",
                attemptCount,
                elapsedMs: Date.now() - startTime,
            });
            throw new Error("Operation aborted");
        }

        return result;
    }
}
