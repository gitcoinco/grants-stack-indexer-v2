import { Hex } from "viem";

import { ChainId, StrategyEvent } from "@grants-stack-indexer/shared";

import { getHandler, IStrategyHandler, ProcessorDependencies } from "../../internal.js";

/**
 * Factory for creating strategy handlers
 */
export class StrategyHandlerFactory {
    /**
     * Create a new instance of a strategy handler for the given strategy ID
     * @param chainId - The chain ID
     * @param dependencies - The processor dependencies
     * @param strategyId - The strategy ID
     * @returns The strategy handler or undefined if it doesn't exist
     */
    static createHandler(
        chainId: ChainId,
        dependencies: ProcessorDependencies,
        strategyId: Hex,
    ): IStrategyHandler<StrategyEvent> | undefined {
        const _strategyId = strategyId.toLowerCase() as Hex;
        const StrategyHandlerClass = getHandler(_strategyId);

        return StrategyHandlerClass ? new StrategyHandlerClass(chainId, dependencies) : undefined;
    }
}
