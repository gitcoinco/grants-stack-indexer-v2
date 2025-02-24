export class InvalidChainId extends Error {
    constructor(chainId: number) {
        super(`Chain ${chainId} not found`);
        this.name = "InvalidChainId";
    }
}
