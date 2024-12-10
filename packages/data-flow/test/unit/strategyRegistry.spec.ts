import { Address, Hex } from "viem";
import { describe, expect, it, vi } from "vitest";

import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { InMemoryStrategyRegistry } from "../../src/registries/strategyRegistry.js";

describe("InMemoryStrategyRegistry", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    const chainId = 1 as ChainId;

    it("return undefined for non-existent strategy address", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const strategyAddress = "0x123" as Address;

        const strategyId = await registry.getStrategyId(chainId, strategyAddress);
        expect(strategyId).toBeUndefined();
    });

    it("save and retrieve strategy id", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const strategyAddress = "0x123" as Address;
        const strategyId = "0xabc" as Hex;

        await registry.saveStrategyId(chainId, strategyAddress, strategyId, true);
        const retrieved = await registry.getStrategyId(chainId, strategyAddress);

        expect(retrieved).toEqual({
            id: strategyId,
            address: strategyAddress,
            chainId,
            handled: true,
        });
    });

    it("handle multiple strategy addresses independently", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const firstAddress = "0x123" as Address;
        const secondAddress = "0x456" as Address;
        const firstStrategyId = "0xabc" as Hex;
        const secondStrategyId = "0xdef" as Hex;

        await registry.saveStrategyId(chainId, firstAddress, firstStrategyId, true);
        await registry.saveStrategyId(chainId, secondAddress, secondStrategyId, true);

        const retrievedFirst = await registry.getStrategyId(chainId, firstAddress);
        const retrievedSecond = await registry.getStrategyId(chainId, secondAddress);

        expect(retrievedFirst).toEqual({
            id: firstStrategyId,
            address: firstAddress,
            chainId,
            handled: true,
        });
        expect(retrievedSecond).toEqual({
            id: secondStrategyId,
            address: secondAddress,
            chainId,
            handled: true,
        });
    });
});
