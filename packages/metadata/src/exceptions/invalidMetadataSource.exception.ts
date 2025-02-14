import { NonRetriableError } from "@grants-stack-indexer/shared";

export class InvalidMetadataSourceException extends NonRetriableError {
    constructor() {
        super(`Invalid metadata source`);
    }
}
