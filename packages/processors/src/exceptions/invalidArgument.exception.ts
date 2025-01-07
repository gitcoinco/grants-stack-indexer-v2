import { NonRetriableError } from "@grants-stack-indexer/shared";

export class InvalidArgument extends NonRetriableError {
    constructor(message: string) {
        super(message);
    }
}
