export class MetadataNotFound extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MetadataNotFoundError";
    }
}
