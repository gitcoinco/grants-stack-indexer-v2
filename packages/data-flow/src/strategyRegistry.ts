import type { Address, Hex } from "viem";

import { ILogger } from "@grants-stack-indexer/shared";

import type { IStrategyRegistry } from "./internal.js";

/**
 * Class to store strategy ids in memory
 */
//TODO: Implement storage to persist strategies. since we're using address, do we need ChainId?
export class InMemoryStrategyRegistry implements IStrategyRegistry {
    private strategiesMap: Map<Address, Hex> = new Map();
    constructor(private logger: ILogger) {}

    /** @inheritdoc */
    async getStrategyId(strategyAddress: Address): Promise<Hex | undefined> {
        return this.strategiesMap.get(strategyAddress);
    }

    /** @inheritdoc */
    async saveStrategyId(strategyAddress: Address, strategyId: Hex): Promise<void> {
        this.logger.debug(`Saving strategy id ${strategyId} for address ${strategyAddress}`);
        this.strategiesMap.set(strategyAddress, strategyId);
    }
}
