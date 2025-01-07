import { NonRetriableError } from "@grants-stack-indexer/shared";

export class InvalidArgumentException extends NonRetriableError {
    constructor(message: string) {
        super(message);
    }
}
