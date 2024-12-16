import type { Address, Hex } from "viem";

import { IStrategyRegistryRepository, Strategy } from "@grants-stack-indexer/repository";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { IStrategyRegistry } from "../../internal.js";

/**
 * Class to store strategy ids in Database
 */
export class DatabaseStrategyRegistry implements IStrategyRegistry {
    constructor(
        private logger: ILogger,
        private strategyRepository: IStrategyRegistryRepository,
    ) {}

    /** @inheritdoc */
    async getStrategies(filters?: { handled?: boolean; chainId?: ChainId }): Promise<Strategy[]> {
        return this.strategyRepository.getStrategies(filters);
    }

    /** @inheritdoc */
    async getStrategyId(chainId: ChainId, strategyAddress: Address): Promise<Strategy | undefined> {
        return this.strategyRepository.getStrategyByChainIdAndAddress(chainId, strategyAddress);
    }

    /** @inheritdoc */
    async saveStrategyId(
        chainId: ChainId,
        strategyAddress: Address,
        strategyId: Hex,
        handled: boolean,
    ): Promise<void> {
        this.logger.debug(
            `Saving strategy id ${strategyId} for address ${strategyAddress} and chainId ${chainId} in Database`,
        );
        await this.strategyRepository.saveStrategy({
            chainId,
            address: strategyAddress,
            id: strategyId,
            handled,
        });
    }
}
