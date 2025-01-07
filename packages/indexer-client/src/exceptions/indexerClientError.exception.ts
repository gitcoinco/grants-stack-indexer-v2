import { ErrorContext, NonRetriableError } from "@grants-stack-indexer/shared";

export class IndexerClientError extends NonRetriableError {
    constructor(message: string, context?: ErrorContext, error?: Error) {
        super(`Indexer client error - ${message}`, context, error);
    }
}
