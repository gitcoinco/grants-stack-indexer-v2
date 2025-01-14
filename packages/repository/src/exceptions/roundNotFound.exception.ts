import { ChainId, NonRetriableError } from "@grants-stack-indexer/shared";

export class RoundNotFound extends NonRetriableError {
    constructor(chainId: ChainId, strategyAddress: string) {
        super(`Round not found for chainId: ${chainId} and strategyAddress: ${strategyAddress}`);
    }
}

export class RoundNotFoundForId extends NonRetriableError {
    constructor(chainId: ChainId, roundId: string) {
        super(`Round not found for chainId: ${chainId} and roundId: ${roundId}`);
    }
}
