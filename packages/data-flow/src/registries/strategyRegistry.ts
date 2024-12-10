import type { Address, Hex } from "viem";

import { Strategy } from "@grants-stack-indexer/repository";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import type { IStrategyRegistry } from "../internal.js";

/**
 * Class to store strategy ids in memory
 */
export class InMemoryStrategyRegistry implements IStrategyRegistry {
    private strategiesMap: Map<ChainId, Map<Address, Strategy>> = new Map();
    constructor(private logger: ILogger) {}

    /** @inheritdoc */
    async getStrategies(params?: { handled?: boolean; chainId?: ChainId }): Promise<Strategy[]> {
        return Array.from(this.strategiesMap.entries())
            .filter(([chainId]) => params?.chainId === undefined || chainId === params.chainId)
            .map(([chainId, strategies]) =>
                Array.from(strategies.entries())
                    .filter(
                        ([_address, strategy]) =>
                            params?.handled === undefined || strategy.handled === params.handled,
                    )
                    .map(([address, strategy]) => ({
                        id: strategy.id,
                        address,
                        chainId,
                        handled: strategy.handled,
                    })),
            )
            .flat();
    }

    /** @inheritdoc */
    async getStrategyId(chainId: ChainId, strategyAddress: Address): Promise<Strategy | undefined> {
        return this.strategiesMap.get(chainId)?.get(strategyAddress);
    }

    /** @inheritdoc */
    async saveStrategyId(
        chainId: ChainId,
        strategyAddress: Address,
        strategyId: Hex,
        handled: boolean,
    ): Promise<void> {
        this.logger.debug(`Saving strategy id ${strategyId} for address ${strategyAddress}`);
        if (!this.strategiesMap.has(chainId)) {
            this.strategiesMap.set(chainId, new Map());
        }
        this.strategiesMap.get(chainId)!.set(strategyAddress, {
            address: strategyAddress,
            id: strategyId,
            chainId,
            handled,
        });
    }
}
