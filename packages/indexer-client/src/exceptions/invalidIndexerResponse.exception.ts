import { NonRetriableError } from "@grants-stack-indexer/shared";

export class InvalidIndexerResponse extends NonRetriableError {
    constructor(response: string) {
        super(`Indexer response is invalid - ${response}`);
    }
}
