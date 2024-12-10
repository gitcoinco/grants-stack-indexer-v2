import { Address, ChainId } from "@grants-stack-indexer/shared";

import { Strategy } from "../internal.js";

export interface IStrategyRepository {
    getStrategyByChainIdAndAddress(
        chainId: ChainId,
        strategyAddress: Address,
    ): Promise<Strategy | undefined>;
    saveStrategy(strategy: Strategy): Promise<void>;
    getStrategies(params?: { handled?: boolean; chainId?: ChainId }): Promise<Strategy[]>;
}
