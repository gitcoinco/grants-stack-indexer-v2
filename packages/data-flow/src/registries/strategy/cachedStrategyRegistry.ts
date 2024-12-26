import { Strategy } from "@grants-stack-indexer/repository";
import { Address, ChainId, Hex, ILogger } from "@grants-stack-indexer/shared";

import { IStrategyRegistry } from "../../internal.js";

/**
 * Proxy class to cache the strategy ids in memory or fallback to another strategy registry
 */
export class InMemoryCachedStrategyRegistry implements IStrategyRegistry {
    private cache: Map<ChainId, Map<Address, Strategy>>;

    private constructor(
        private readonly logger: ILogger,
        private readonly strategyRegistry: IStrategyRegistry,
        cache: Map<ChainId, Map<Address, Strategy>>,
    ) {
        this.cache = structuredClone(cache);
    }

    /** @inheritdoc */
    async getStrategies(filters?: { handled?: boolean; chainId?: ChainId }): Promise<Strategy[]> {
        return this.strategyRegistry.getStrategies(filters);
    }

    /**
     * Creates a new cached strategy registry instance. It will load the strategies into memory and cache them and
     * fallback to the strategy registry if the strategy is not found in the cache.
     *
     * @param logger - The logger instance
     * @param strategyRegistry - The strategy registry instance
     * @param chainId - The chain ID to load strategies for
     * @returns The initialized cached strategy registry
     */
    static async initialize(
        logger: ILogger,
        strategyRegistry: IStrategyRegistry,
        chainId: ChainId,
    ): Promise<InMemoryCachedStrategyRegistry> {
        const cache = new Map<ChainId, Map<Address, Strategy>>();

        logger.debug(`Loading strategies into memory for chain ID: ${chainId}...`);

        const strategies = await strategyRegistry.getStrategies({ chainId });

        for (const strategy of strategies) {
            if (!cache.has(strategy.chainId)) {
                cache.set(strategy.chainId, new Map());
            }
            cache.get(strategy.chainId)?.set(strategy.address, strategy);
        }

        return new InMemoryCachedStrategyRegistry(logger, strategyRegistry, cache);
    }

    /** @inheritdoc */
    async getStrategyId(chainId: ChainId, strategyAddress: Address): Promise<Strategy | undefined> {
        const cache = this.cache.get(chainId)?.get(strategyAddress);
        if (cache) {
            return cache;
        }

        const strategy = await this.strategyRegistry.getStrategyId(chainId, strategyAddress);
        if (strategy) {
            if (!this.cache.has(strategy.chainId)) {
                this.cache.set(strategy.chainId, new Map());
            }

            this.cache.get(strategy.chainId)?.set(strategyAddress, strategy);
        }
        return strategy;
    }

    /** @inheritdoc */
    async saveStrategyId(
        chainId: ChainId,
        strategyAddress: Address,
        strategyId: Hex,
        handled: boolean,
    ): Promise<void> {
        if (this.cache.get(chainId)?.get(strategyAddress)?.handled === handled) {
            return;
        }

        this.logger.debug(
            `Saving strategy id ${strategyId} for address ${strategyAddress} and chainId ${chainId}`,
            {
                className: InMemoryCachedStrategyRegistry.name,
                chainId,
            },
        );
        await this.strategyRegistry.saveStrategyId(chainId, strategyAddress, strategyId, handled);

        if (!this.cache.has(chainId)) {
            this.cache.set(chainId, new Map());
        }

        this.cache.get(chainId)?.set(strategyAddress, {
            address: strategyAddress,
            id: strategyId,
            chainId,
            handled,
        });
    }
}
