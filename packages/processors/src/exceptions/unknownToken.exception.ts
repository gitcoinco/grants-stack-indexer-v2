import { ChainId } from "@grants-stack-indexer/shared";

export class UnknownToken extends Error {
    constructor(tokenAddress: string, chainId?: ChainId) {
        super(`Unknown token: ${tokenAddress} ${chainId ? `on chain ${chainId}` : ""}`);
    }
}
