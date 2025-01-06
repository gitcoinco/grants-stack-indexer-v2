import { ErrorContext, RetriableError } from "@grants-stack-indexer/shared";

export class MetadataNotFound extends RetriableError {
    constructor(message: string, context: ErrorContext = {}, error?: Error) {
        super(message, context, {}, error);
    }
}
