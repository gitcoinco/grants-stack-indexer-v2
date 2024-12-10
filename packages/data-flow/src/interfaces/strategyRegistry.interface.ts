import { Address, Hex } from "viem";

import { Strategy } from "@grants-stack-indexer/repository";
import { ChainId } from "@grants-stack-indexer/shared";

/**
 * The strategy registry saves the mapping between the strategy address and the strategy id. Serves as a Cache
 * to avoid having to read from the chain to get the strategy id every time.
 */
export interface IStrategyRegistry {
    /**
     * Get the strategy id by the strategy address and chain id
     *
     * @param chainId - The chain id
     * @param strategyAddress - The strategy address
     * @returns The strategy or undefined if the strategy address is not registered
     */
    getStrategyId(chainId: ChainId, strategyAddress: Address): Promise<Strategy | undefined>;
    /**
     * Save the strategy id by the strategy address and chain id
     * @param chainId - The chain id
     * @param strategyAddress - The strategy address
     * @param strategyId - The strategy id
     * @param handled - Whether the strategy is handled
     */
    saveStrategyId(
        chainId: ChainId,
        strategyAddress: Address,
        strategyId: Hex,
        handled: boolean,
    ): Promise<void>;

    /**
     * Get all the strategies
     * @returns The strategies
     */
    getStrategies(params?: { handled?: boolean; chainId?: ChainId }): Promise<Strategy[]>;
}
