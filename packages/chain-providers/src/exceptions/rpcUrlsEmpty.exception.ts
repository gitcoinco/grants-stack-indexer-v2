import { NonRetriableError } from "@grants-stack-indexer/shared";

export class RpcUrlsEmpty extends NonRetriableError {
    constructor() {
        super("RPC URLs array cannot be empty");
    }
}
