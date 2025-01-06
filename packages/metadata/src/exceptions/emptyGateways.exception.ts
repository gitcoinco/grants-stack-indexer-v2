import { NonRetriableError } from "@grants-stack-indexer/shared";

export class EmptyGatewaysUrlsException extends NonRetriableError {
    constructor() {
        super("Gateways array cannot be empty");
    }
}
