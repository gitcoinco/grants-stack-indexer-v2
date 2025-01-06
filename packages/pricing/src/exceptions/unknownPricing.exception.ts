import { ErrorContext, RetriableError } from "@grants-stack-indexer/shared";

export class UnknownPricingException extends RetriableError {
    constructor(message: string, context: ErrorContext) {
        super(message, context);
    }
}
