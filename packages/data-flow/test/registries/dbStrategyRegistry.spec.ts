import { Address, Hex } from "viem";
import { describe, expect, it, vi } from "vitest";

import { IStrategyRepository, Strategy } from "@grants-stack-indexer/repository";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { DatabaseStrategyRegistry } from "../../src/registries/strategy/dbStrategyRegistry.js";

describe("DatabaseStrategyRegistry", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    const mockStrategyRepository: IStrategyRepository = {
        getStrategies: vi.fn(),
        getStrategyByChainIdAndAddress: vi.fn(),
        saveStrategy: vi.fn(),
    };

    const chainId = 1 as ChainId;

    it("return undefined for non-existent strategy address", async () => {
        const registry = new DatabaseStrategyRegistry(logger, mockStrategyRepository);
        const strategyAddress = "0x123" as Address;

        vi.mocked(mockStrategyRepository.getStrategyByChainIdAndAddress).mockResolvedValue(
            undefined,
        );

        const strategy = await registry.getStrategyId(chainId, strategyAddress);
        expect(strategy).toBeUndefined();
        expect(mockStrategyRepository.getStrategyByChainIdAndAddress).toHaveBeenCalledWith(
            chainId,
            strategyAddress,
        );
    });

    it("save and retrieve strategy id", async () => {
        const registry = new DatabaseStrategyRegistry(logger, mockStrategyRepository);
        const strategyAddress = "0x123" as Address;
        const strategyId = "0xabc" as Hex;
        const strategy: Strategy = {
            id: strategyId,
            address: strategyAddress,
            chainId,
            handled: true,
        };

        vi.mocked(mockStrategyRepository.saveStrategy).mockResolvedValue();
        vi.mocked(mockStrategyRepository.getStrategyByChainIdAndAddress).mockResolvedValue(
            strategy,
        );

        await registry.saveStrategyId(chainId, strategyAddress, strategyId, true);
        const retrieved = await registry.getStrategyId(chainId, strategyAddress);

        expect(mockStrategyRepository.saveStrategy).toHaveBeenCalledWith(strategy);
        expect(retrieved).toEqual(strategy);
    });

    it("get all strategies", async () => {
        const registry = new DatabaseStrategyRegistry(logger, mockStrategyRepository);
        const strategies: Strategy[] = [
            {
                id: "0xabc" as Hex,
                address: "0x123" as Address,
                chainId: 1 as ChainId,
                handled: true,
            },
            {
                id: "0xdef" as Hex,
                address: "0x456" as Address,
                chainId: 1 as ChainId,
                handled: false,
            },
        ];

        vi.mocked(mockStrategyRepository.getStrategies).mockResolvedValue(strategies);

        const result = await registry.getStrategies();
        expect(result).toEqual(strategies);
    });

    it("get strategies with filters", async () => {
        const registry = new DatabaseStrategyRegistry(logger, mockStrategyRepository);
        const params = { handled: true, chainId: 1 as ChainId };

        await registry.getStrategies(params);
        expect(mockStrategyRepository.getStrategies).toHaveBeenCalledWith(params);
    });
});
