import { NonRetriableError } from "@grants-stack-indexer/shared";

export class NoClosePriceFound extends NonRetriableError {
    constructor() {
        super(`No close price found`);
    }
}
