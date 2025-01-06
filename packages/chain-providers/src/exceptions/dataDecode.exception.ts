import { NonRetriableError } from "@grants-stack-indexer/shared";

export class DataDecodeException extends NonRetriableError {
    constructor(message: string) {
        super(message);
    }
}
