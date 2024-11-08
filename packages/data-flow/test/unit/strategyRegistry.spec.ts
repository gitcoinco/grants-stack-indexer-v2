import { Address, Hex } from "viem";
import { describe, expect, it, vi } from "vitest";

import { ILogger } from "@grants-stack-indexer/shared";

import { InMemoryStrategyRegistry } from "../../src/strategyRegistry.js";

describe("InMemoryStrategyRegistry", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    it("return undefined for non-existent strategy address", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const strategyAddress = "0x123" as Address;

        const strategyId = await registry.getStrategyId(strategyAddress);
        expect(strategyId).toBeUndefined();
    });

    it("save and retrieve strategy id", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const strategyAddress = "0x123" as Address;
        const strategyId = "0xabc" as Hex;

        await registry.saveStrategyId(strategyAddress, strategyId);
        const retrievedId = await registry.getStrategyId(strategyAddress);

        expect(retrievedId).toBe(strategyId);
    });

    it("handle multiple strategy addresses independently", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const firstAddress = "0x123" as Address;
        const secondAddress = "0x456" as Address;
        const firstStrategyId = "0xabc" as Hex;
        const secondStrategyId = "0xdef" as Hex;

        await registry.saveStrategyId(firstAddress, firstStrategyId);
        await registry.saveStrategyId(secondAddress, secondStrategyId);

        const retrievedFirstId = await registry.getStrategyId(firstAddress);
        const retrievedSecondId = await registry.getStrategyId(secondAddress);

        expect(retrievedFirstId).toBe(firstStrategyId);
        expect(retrievedSecondId).toBe(secondStrategyId);
    });
});
