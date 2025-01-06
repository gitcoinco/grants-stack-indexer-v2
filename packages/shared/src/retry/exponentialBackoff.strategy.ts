import { RetryStrategy, RetryStrategyOptions } from "./index.js";

type ExponentialBackoffOptions = RetryStrategyOptions & {
    factor: number;
};

/**
 * Implements exponential backoff retry strategy with jitter
 *
 * Exponentially increases delay between retry attempts by multiplying base delay
 * by a factor raised to the attempt count. Also adds random jitter to prevent
 * thundering herd problems.
 */
export class ExponentialBackoff implements RetryStrategy {
    /**
     * @param options - Configuration options
     * @param options.baseDelay - Initial delay in milliseconds (default: 5000)
     * @param options.factor - Multiplier for exponential increase (default: 2)
     * @param options.maxAttempts - Maximum number of retry attempts (default: 3)
     * @param options.maxDelay - Optional maximum delay cap in milliseconds
     */
    constructor(
        private readonly options: ExponentialBackoffOptions = {
            baseDelay: 5000,
            factor: 2,
            maxAttempts: 3,
        },
    ) {}

    /** @inheritdoc */
    getDelay(attemptCount: number, retryAfter?: number): number {
        const calculatedDelay =
            this.options.baseDelay * Math.pow(this.options.factor, attemptCount);
        const targetDelay = this.options.maxDelay
            ? Math.min(calculatedDelay, this.options.maxDelay)
            : calculatedDelay;

        const delay = retryAfter ? Math.max(retryAfter, targetDelay) : targetDelay;
        return this.addJitter(delay);
    }

    /** @inheritdoc */
    shouldRetry(attemptCount: number): boolean {
        return attemptCount < this.options.maxAttempts;
    }

    /**
     * Adds random jitter to delay value to prevent thundering herd
     * @param delay - Base delay value in milliseconds
     * @returns Delay with jitter applied (±20% of base delay)
     */
    private addJitter(delay: number): number {
        // Random value between 0.8 and 1.2
        const jitterFactor = 0.8 + Math.random() * 0.4;
        return Math.floor(delay * jitterFactor);
    }
}
