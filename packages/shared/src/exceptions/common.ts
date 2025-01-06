import { ErrorContext, RetriableError, RetryMetadata } from "./index.js";

export class NetworkError extends RetriableError {
    constructor(context: ErrorContext, metadata?: RetryMetadata, cause?: Error) {
        super("Network request failed", context, metadata, cause);
    }
}

export class RateLimitError extends RetriableError {
    constructor(context: ErrorContext, retryAfterInMs?: number) {
        super("Rate limit exceeded", context, {
            retryAfterInMs,
            statusCode: 429,
            failureReason: "Rate limit exceeded",
        });
    }
}
