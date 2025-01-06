import { BaseError, ErrorContext } from "./index.js";

export class NonRetriableError extends BaseError {
    constructor(message: string, context: ErrorContext = {}, cause?: Error) {
        super(message, context, cause);
    }
}
