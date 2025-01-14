import { NonRetriableError } from "@grants-stack-indexer/shared";

export class InvalidCidException extends NonRetriableError {
    constructor(cid: string) {
        super(`Invalid CID: ${cid}`);
    }
}
