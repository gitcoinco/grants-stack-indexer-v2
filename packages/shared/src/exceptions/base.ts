export interface ErrorContext {
    chainId?: string;
    className?: string;
    methodName?: string;
    timestamp?: Date;
    additionalData?: Record<string, unknown>;
}

export abstract class BaseError extends Error {
    public readonly context: ErrorContext;

    constructor(
        message: string,
        context: ErrorContext,
        public override readonly cause?: Error,
    ) {
        super(message);
        this.context = {
            ...context,
            timestamp: new Date(),
        };

        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Get the full error chain as a string
     */
    getFullStack(): string {
        let stack = this.stack || "";
        let currentCause = this.cause;

        while (currentCause) {
            stack += "\nCaused by: " + (currentCause.stack || currentCause);
            currentCause = (currentCause as Error & { cause?: Error }).cause;
        }

        return stack;
    }
}
