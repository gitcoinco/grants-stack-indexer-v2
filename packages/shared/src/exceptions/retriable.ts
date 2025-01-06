import { BaseError, ErrorContext } from "./index.js";

export interface RetryMetadata {
    retryAfterInMs?: number; // Optional time in ms specified by service
    statusCode?: number; // HTTP status code if applicable
    failureReason?: string; // Specific reason for the failure
}

export class RetriableError extends BaseError {
    constructor(
        message: string,
        context: ErrorContext,
        public readonly metadata?: RetryMetadata,
        cause?: Error,
    ) {
        super(message, context, cause);
    }
}
