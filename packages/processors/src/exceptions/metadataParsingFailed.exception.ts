export class MetadataParsingFailed extends Error {
    constructor(additionalInfo?: string) {
        super(`Failed to parse application metadata: ${additionalInfo}`);
    }
}
