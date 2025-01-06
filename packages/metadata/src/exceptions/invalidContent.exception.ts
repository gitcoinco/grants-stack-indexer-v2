import { NonRetriableError } from "@grants-stack-indexer/shared";

export class InvalidContentException extends NonRetriableError {
    constructor(message: string) {
        super(message);
    }
}
