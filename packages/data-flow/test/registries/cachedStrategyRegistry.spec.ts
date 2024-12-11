import { Address, Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Strategy } from "@grants-stack-indexer/repository";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { IStrategyRegistry } from "../../src/internal.js";
import { InMemoryCachedStrategyRegistry } from "../../src/registries/cachedStrategyRegistry.js";

describe("InMemoryCachedStrategyRegistry", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    const mockStrategyRegistry: IStrategyRegistry = {
        getStrategies: vi.fn(),
        getStrategyId: vi.fn(),
        saveStrategyId: vi.fn(),
    };

    const chainId = 1 as ChainId;
    const strategyAddress = "0x123" as Address;
    const strategyId = "0xabc" as Hex;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("initialize with existing strategies", async () => {
        const strategies: Strategy[] = [
            {
                id: strategyId,
                address: strategyAddress,
                chainId,
                handled: true,
            },
        ];

        vi.mocked(mockStrategyRegistry.getStrategies).mockResolvedValue(strategies);

        const registry = await InMemoryCachedStrategyRegistry.initialize(
            logger,
            mockStrategyRegistry,
        );
        const cached = await registry.getStrategyId(chainId, strategyAddress);

        expect(cached).toEqual(strategies[0]);
        expect(mockStrategyRegistry.getStrategyId).not.toHaveBeenCalled();
    });

    it("fetch from underlying registry when not in cache", async () => {
        const strategy: Strategy = {
            id: strategyId,
            address: strategyAddress,
            chainId,
            handled: true,
        };

        vi.mocked(mockStrategyRegistry.getStrategies).mockResolvedValue([]);
        vi.mocked(mockStrategyRegistry.getStrategyId).mockResolvedValue(strategy);

        const registry = await InMemoryCachedStrategyRegistry.initialize(
            logger,
            mockStrategyRegistry,
        );
        const result = await registry.getStrategyId(chainId, strategyAddress);

        expect(result).toEqual(strategy);
        expect(mockStrategyRegistry.getStrategyId).toHaveBeenCalledWith(chainId, strategyAddress);
    });

    it("save strategy and update cache", async () => {
        vi.mocked(mockStrategyRegistry.getStrategies).mockResolvedValue([]);

        const registry = await InMemoryCachedStrategyRegistry.initialize(
            logger,
            mockStrategyRegistry,
        );
        await registry.saveStrategyId(chainId, strategyAddress, strategyId, true);

        const cached = await registry.getStrategyId(chainId, strategyAddress);
        expect(cached).toEqual({
            id: strategyId,
            address: strategyAddress,
            chainId,
            handled: true,
        });
        expect(mockStrategyRegistry.saveStrategyId).toHaveBeenCalledWith(
            chainId,
            strategyAddress,
            strategyId,
            true,
        );
    });

    it("don't save if strategy already exists with same handled status", async () => {
        const strategy: Strategy = {
            id: strategyId,
            address: strategyAddress,
            chainId,
            handled: true,
        };

        vi.mocked(mockStrategyRegistry.getStrategies).mockResolvedValue([strategy]);

        const registry = await InMemoryCachedStrategyRegistry.initialize(
            logger,
            mockStrategyRegistry,
        );
        await registry.saveStrategyId(chainId, strategyAddress, strategyId, true);

        expect(mockStrategyRegistry.saveStrategyId).not.toHaveBeenCalled();
    });

    it("delegate getStrategies to underlying registry", async () => {
        const strategies: Strategy[] = [
            {
                id: strategyId,
                address: strategyAddress,
                chainId,
                handled: true,
            },
        ];

        vi.mocked(mockStrategyRegistry.getStrategies).mockResolvedValue(strategies);

        const registry = await InMemoryCachedStrategyRegistry.initialize(
            logger,
            mockStrategyRegistry,
        );
        const params = { handled: true, chainId };
        const result = await registry.getStrategies(params);

        expect(result).toEqual(strategies);
        expect(mockStrategyRegistry.getStrategies).toHaveBeenCalledWith(params);
    });
});
