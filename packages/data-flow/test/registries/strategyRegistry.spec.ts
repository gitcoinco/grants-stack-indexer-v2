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

    it("get all strategies without filters", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const firstChainId = 1 as ChainId;
        const secondChainId = 5 as ChainId;

        // Add strategies to different chains with different handled status
        await registry.saveStrategyId(firstChainId, "0x123" as Address, "0xabc" as Hex, true);
        await registry.saveStrategyId(firstChainId, "0x456" as Address, "0xdef" as Hex, false);
        await registry.saveStrategyId(secondChainId, "0x789" as Address, "0xghi" as Hex, true);

        const strategies = await registry.getStrategies();
        expect(strategies).toHaveLength(3);
        expect(strategies).toEqual(
            expect.arrayContaining([
                {
                    id: "0xabc" as Hex,
                    address: "0x123" as Address,
                    chainId: firstChainId,
                    handled: true,
                },
                {
                    id: "0xdef" as Hex,
                    address: "0x456" as Address,
                    chainId: firstChainId,
                    handled: false,
                },
                {
                    id: "0xghi" as Hex,
                    address: "0x789" as Address,
                    chainId: secondChainId,
                    handled: true,
                },
            ]),
        );
    });

    it("filter strategies by chainId", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const firstChainId = 1 as ChainId;
        const secondChainId = 5 as ChainId;

        await registry.saveStrategyId(firstChainId, "0x123" as Address, "0xabc" as Hex, true);
        await registry.saveStrategyId(secondChainId, "0x456" as Address, "0xdef" as Hex, true);

        const strategies = await registry.getStrategies({ chainId: firstChainId });
        expect(strategies).toHaveLength(1);
        expect(strategies[0]).toEqual({
            id: "0xabc" as Hex,
            address: "0x123" as Address,
            chainId: firstChainId,
            handled: true,
        });
    });

    it("filter strategies by handled status", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const chainId = 1 as ChainId;

        await registry.saveStrategyId(chainId, "0x123" as Address, "0xabc" as Hex, true);
        await registry.saveStrategyId(chainId, "0x456" as Address, "0xdef" as Hex, false);

        const handledStrategies = await registry.getStrategies({ handled: true });
        expect(handledStrategies).toHaveLength(1);
        expect(handledStrategies[0]).toEqual({
            id: "0xabc" as Hex,
            address: "0x123" as Address,
            chainId,
            handled: true,
        });

        const unhandledStrategies = await registry.getStrategies({ handled: false });
        expect(unhandledStrategies).toHaveLength(1);
        expect(unhandledStrategies[0]).toEqual({
            id: "0xdef" as Hex,
            address: "0x456" as Address,
            chainId,
            handled: false,
        });
    });

    it("filter strategies by both chainId and handled status", async () => {
        const registry = new InMemoryStrategyRegistry(logger);
        const firstChainId = 1 as ChainId;
        const secondChainId = 5 as ChainId;

        // Add mix of strategies with different chains and handled status
        await registry.saveStrategyId(firstChainId, "0x123" as Address, "0xabc" as Hex, true);
        await registry.saveStrategyId(firstChainId, "0x456" as Address, "0xdef" as Hex, false);
        await registry.saveStrategyId(secondChainId, "0x789" as Address, "0xghi" as Hex, true);

        const strategies = await registry.getStrategies({
            chainId: firstChainId,
            handled: true,
        });

        expect(strategies).toHaveLength(1);
        expect(strategies[0]).toEqual({
            id: "0xabc" as Hex,
            address: "0x123" as Address,
            chainId: firstChainId,
            handled: true,
        });
    });
});
