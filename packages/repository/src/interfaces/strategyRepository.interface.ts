import { Address, ChainId } from "@grants-stack-indexer/shared";

import { Strategy } from "../internal.js";

export interface IStrategyRegistryRepository {
    /**
     * Retrieves a strategy by its chain ID and address.
     * @param chainId - The chain ID of the strategy.
     * @param strategyAddress - The address of the strategy.
     * @returns A promise that resolves to the strategy object or undefined if not found.
     */
    getStrategyByChainIdAndAddress(
        chainId: ChainId,
        strategyAddress: Address,
    ): Promise<Strategy | undefined>;

    /**
     * Saves a strategy to the repository.
     * @param strategy - The strategy to save.
     */
    saveStrategy(strategy: Strategy): Promise<void>;

    /**
     * Retrieves all strategies from the repository.
     * @param filters - The parameters to filter the strategies.
     * @param filters.handled - Whether to include handled strategies.
     * @param filters.chainId - The chain ID to filter the strategies.
     * @returns A promise that resolves to an array of strategies.
     */
    getStrategies(filters?: { handled?: boolean; chainId?: ChainId }): Promise<Strategy[]>;
}
