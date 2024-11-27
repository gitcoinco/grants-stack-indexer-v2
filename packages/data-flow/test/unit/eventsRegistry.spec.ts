import { describe, expect, it, vi } from "vitest";

import { ChainId, ILogger, ProcessorEvent } from "@grants-stack-indexer/shared";

import { InMemoryEventsRegistry } from "../../src/eventsRegistry.js";

describe("InMemoryEventsRegistry", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    const chainId = 1 as ChainId;
    it("return null when no event has been saved", async () => {
        const registry = new InMemoryEventsRegistry(logger);
        const lastEvent = await registry.getLastProcessedEvent(chainId);
        expect(lastEvent).toBeUndefined();
    });

    it("save and retrieve the last processed event", async () => {
        const registry = new InMemoryEventsRegistry(logger);
        const mockEvent: ProcessorEvent<"Allo", "PoolCreated"> = {
            contractName: "Allo",
            eventName: "PoolCreated",
            blockNumber: 1,
            blockTimestamp: 1234567890,
            chainId: 1 as ChainId,
            logIndex: 0,
            srcAddress: "0x123",
            strategyId: "0xstrategy",
            params: {
                poolId: 1n,
                profileId: "0x456",
                strategy: "0x789",
                token: "0xtoken",
                amount: 0n,
                metadata: [1n, "0xmetadata"],
            },
            transactionFields: {
                hash: "0xabc",
                transactionIndex: 0,
            },
        };

        await registry.saveLastProcessedEvent(chainId, mockEvent);
        const retrievedEvent = await registry.getLastProcessedEvent(chainId);

        expect(retrievedEvent).toEqual(mockEvent);
    });

    it("updates the last processed event when saving multiple times", async () => {
        const registry = new InMemoryEventsRegistry(logger);

        const firstEvent: ProcessorEvent<"Allo", "PoolCreated"> = {
            contractName: "Allo",
            eventName: "PoolCreated",
            blockNumber: 1,
            blockTimestamp: 1234567890,
            chainId: 1 as ChainId,
            logIndex: 0,
            srcAddress: "0x123",
            strategyId: "0xstrategy",
            params: {
                poolId: 1n,
                profileId: "0x456",
                strategy: "0x789",
                token: "0xtoken",
                amount: 0n,
                metadata: [1n, "0xmetadata"],
            },
            transactionFields: {
                hash: "0xabc",
                transactionIndex: 0,
            },
        };

        const secondEvent: ProcessorEvent<"Strategy", "RegisteredWithSender"> = {
            contractName: "Strategy",
            eventName: "RegisteredWithSender",
            blockNumber: 1,
            blockTimestamp: 1234567890,
            chainId: 1 as ChainId,
            logIndex: 0,
            srcAddress: "0x123",
            strategyId: "0xstrategy",
            params: {
                recipientId: "0xrecipient",
                data: "0xdata",
                sender: "0xsender",
            },
            transactionFields: {
                hash: "0xabc",
                transactionIndex: 0,
            },
        };

        await registry.saveLastProcessedEvent(chainId, firstEvent);
        await registry.saveLastProcessedEvent(chainId, secondEvent);

        const lastEvent = await registry.getLastProcessedEvent(chainId);
        expect(lastEvent).toEqual(secondEvent);
        expect(lastEvent).not.toEqual(firstEvent);
    });
});
