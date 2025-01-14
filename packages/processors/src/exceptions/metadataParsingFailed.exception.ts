import { NonRetriableError } from "@grants-stack-indexer/shared";

export class MetadataParsingFailed extends NonRetriableError {
    constructor(additionalInfo?: string) {
        super(`Failed to parse application metadata: ${additionalInfo}`);
    }
}
