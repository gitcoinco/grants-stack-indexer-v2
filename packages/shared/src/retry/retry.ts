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
    ) {}

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
        let result: T | undefined;
        let attemptCount = 0;
        while (true && !params.abortSignal?.aborted) {
            try {
                result = await operation();
                break;
            } catch (error) {
                if (!(error instanceof RetriableError)) {
                    throw error;
                }
                attemptCount++;

                if (!this.strategy.shouldRetry(attemptCount)) {
                    throw error;
                } else {
                    const delay = this.strategy.getDelay(
                        attemptCount,
                        error.metadata?.retryAfterInMs,
                    );

                    this.logger.debug(`Retrying in ${delay}ms`, {
                        className: RetryHandler.name,
                        delay,
                    });

                    await new Promise((resolve) => setTimeout(resolve, delay, params.abortSignal));
                }
            }
        }

        if (params.abortSignal?.aborted) {
            throw new Error("Operation aborted");
        }

        return result;
    }
}
