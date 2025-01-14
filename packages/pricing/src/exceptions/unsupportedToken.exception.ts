import { ErrorContext, NonRetriableError, TokenCode } from "@grants-stack-indexer/shared";

export class UnsupportedToken extends NonRetriableError {
    constructor(tokenCode: TokenCode, context: ErrorContext) {
        super(`Unsupported token: ${tokenCode}`, context);
    }
}
