import { ChainId, Hex } from "@grants-stack-indexer/shared";

export type StrategyProcessingCheckpoint = {
    chainId: ChainId;
    strategyId: Hex;
    lastProcessedBlockNumber: number;
    lastProcessedLogIndex: number;
    createdAt?: Date;
    updatedAt?: Date;
};

export type NewStrategyProcessingCheckpoint = Omit<
    StrategyProcessingCheckpoint,
    "createdAt" | "updatedAt"
>;
