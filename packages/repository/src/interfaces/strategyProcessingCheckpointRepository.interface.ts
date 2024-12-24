import { ChainId, Hex } from "@grants-stack-indexer/shared";

import { NewStrategyProcessingCheckpoint, StrategyProcessingCheckpoint } from "../internal.js";

export interface IStrategyProcessingCheckpointRepository {
    /**
     * Get the latest checkpoint for a strategy
     * @param chainId - The chain ID
     * @param strategyId - The strategy ID
     */
    getCheckpoint(
        chainId: ChainId,
        strategyId: Hex,
    ): Promise<StrategyProcessingCheckpoint | undefined>;

    /**
     * Upsert a checkpoint for a strategy
     * @param checkpoint - The checkpoint data to upsert
     */
    upsertCheckpoint(checkpoint: NewStrategyProcessingCheckpoint): Promise<void>;

    /**
     * Delete the checkpoint for a strategy
     * @param chainId - The chain ID
     * @param strategyId - The strategy ID
     */
    deleteCheckpoint(chainId: ChainId, strategyId: Hex): Promise<void>;
}
