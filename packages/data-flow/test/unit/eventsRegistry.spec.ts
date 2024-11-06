import { describe, expect, it } from "vitest";

import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { InMemoryEventsRegistry } from "../../src/eventsRegistry.js";

describe("InMemoryEventsRegistry", () => {
    it("return null when no event has been saved", async () => {
        const registry = new InMemoryEventsRegistry();
        const lastEvent = await registry.getLastProcessedEvent();
        expect(lastEvent).toBeUndefined();
    });

    it("save and retrieve the last processed event", async () => {
        const registry = new InMemoryEventsRegistry();
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

        await registry.saveLastProcessedEvent(mockEvent);
        const retrievedEvent = await registry.getLastProcessedEvent();

        expect(retrievedEvent).toEqual(mockEvent);
    });

    it("should update the last processed event when saving multiple times", async () => {
        const registry = new InMemoryEventsRegistry();

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

        await registry.saveLastProcessedEvent(firstEvent);
        await registry.saveLastProcessedEvent(secondEvent);

        const lastEvent = await registry.getLastProcessedEvent();
        expect(lastEvent).toEqual(secondEvent);
        expect(lastEvent).not.toEqual(firstEvent);
    });
});
