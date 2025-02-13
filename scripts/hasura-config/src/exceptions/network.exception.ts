export class NetworkException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NetworkException";
    }
}
