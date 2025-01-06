import { NonRetriableError } from "@grants-stack-indexer/shared";

export class MulticallNotFound extends NonRetriableError {
    constructor() {
        super("Multicall contract address not found");
    }
}
