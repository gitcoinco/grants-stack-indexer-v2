export interface RetryStrategy {
    /**
     * Calculate delay for next retry attempt
     * @param attemptCount - Current retry attempt number
     * @param retryAfter - Optional minimum delay specified by service
     * @returns Delay duration in milliseconds
     */
    getDelay(attemptCount: number, retryAfter?: number): number;

    /**
     * Determine if another retry should be attempted
     * @param attemptCount - Current retry attempt number
     * @returns True if retry should be attempted, false otherwise
     */
    shouldRetry(attemptCount: number): boolean;
}

export type RetryStrategyOptions = {
    baseDelay: number;
    maxDelay?: number;
    factor?: number;
    maxAttempts: number;
};
