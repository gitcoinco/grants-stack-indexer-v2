export class HasuraApiException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "HasuraApiException";
    }
}
