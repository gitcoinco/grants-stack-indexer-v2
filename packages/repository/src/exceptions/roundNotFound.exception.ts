import { ChainId } from "@grants-stack-indexer/shared";

export class RoundNotFound extends Error {
    constructor(chainId: ChainId, strategyAddress: string) {
        super(`Round not found for chainId: ${chainId} and strategyAddress: ${strategyAddress}`);
    }
}

export class RoundNotFoundForId extends Error {
    constructor(chainId: ChainId, roundId: string) {
        super(`Round not found for chainId: ${chainId} and roundId: ${roundId}`);
    }
}
