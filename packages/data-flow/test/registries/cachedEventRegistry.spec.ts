import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewProcessedEvent, ProcessedEvent } from "@grants-stack-indexer/repository";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { IEventsRegistry } from "../../src/internal.js";
import { InMemoryCachedEventRegistry } from "../../src/registries/event/cachedEventRegistry.js";

describe("InMemoryCachedEventRegistry", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    const mockEventRegistry: IEventsRegistry = {
        getLastProcessedEvent: vi.fn(),
        saveLastProcessedEvent: vi.fn(),
    };

    const chainId = 1 as ChainId;
    const mockEvent: ProcessedEvent = {
        chainId,
        blockNumber: 100,
        blockTimestamp: 1234567890,
        logIndex: 1,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("initialize with existing events", async () => {
        vi.mocked(mockEventRegistry.getLastProcessedEvent).mockResolvedValue(mockEvent);

        const registry = await InMemoryCachedEventRegistry.initialize(logger, mockEventRegistry, [
            chainId,
        ]);

        const cached = await registry.getLastProcessedEvent(chainId);
        expect(cached).toEqual(mockEvent);
        expect(mockEventRegistry.getLastProcessedEvent).toHaveBeenCalledTimes(1);
    });

    it("fetch from underlying registry when not in cache", async () => {
        vi.mocked(mockEventRegistry.getLastProcessedEvent)
            .mockResolvedValueOnce(undefined) // For initialization
            .mockResolvedValueOnce(mockEvent); // For actual fetch

        const registry = await InMemoryCachedEventRegistry.initialize(logger, mockEventRegistry, [
            chainId,
        ]);

        const result = await registry.getLastProcessedEvent(chainId);
        expect(result).toEqual(mockEvent);
        expect(mockEventRegistry.getLastProcessedEvent).toHaveBeenCalledTimes(2);
    });

    it("save event and update cache", async () => {
        const registry = await InMemoryCachedEventRegistry.initialize(logger, mockEventRegistry, [
            chainId,
        ]);

        const newEvent: NewProcessedEvent = {
            blockNumber: 200,
            blockTimestamp: 1234577890,
            logIndex: 2,
        };

        await registry.saveLastProcessedEvent(chainId, newEvent);

        // Verify the event was saved to underlying registry
        expect(mockEventRegistry.saveLastProcessedEvent).toHaveBeenCalledWith(chainId, newEvent);

        // Verify the cache was updated
        const cached = await registry.getLastProcessedEvent(chainId);
        expect(cached).toEqual({
            ...newEvent,
            chainId,
        });

        // Verify no additional calls to underlying registry
        expect(mockEventRegistry.getLastProcessedEvent).toHaveBeenCalledTimes(1);
    });

    it("initialize with multiple chain ids", async () => {
        const chainId2 = 5 as ChainId;
        const mockEvent2: ProcessedEvent = { ...mockEvent, chainId: chainId2 };

        vi.mocked(mockEventRegistry.getLastProcessedEvent).mockImplementation(async (chain) =>
            chain === chainId ? mockEvent : mockEvent2,
        );

        const registry = await InMemoryCachedEventRegistry.initialize(logger, mockEventRegistry, [
            chainId,
            chainId2,
        ]);

        const cached1 = await registry.getLastProcessedEvent(chainId);
        const cached2 = await registry.getLastProcessedEvent(chainId2);

        expect(cached1).toEqual(mockEvent);
        expect(cached2).toEqual(mockEvent2);
        expect(mockEventRegistry.getLastProcessedEvent).toHaveBeenCalledTimes(2);
    });

    it("throws error when underlying registry throws error", async () => {
        vi.mocked(mockEventRegistry.saveLastProcessedEvent).mockRejectedValue(
            new Error("Saving error"),
        );

        const registry = await InMemoryCachedEventRegistry.initialize(logger, mockEventRegistry, [
            chainId,
        ]);
        const cacheSetSpy = vi.spyOn(registry["cache"], "set");

        await expect(registry.saveLastProcessedEvent(chainId, mockEvent)).rejects.toThrow(
            "Saving error",
        );
        expect(cacheSetSpy).not.toHaveBeenCalled();
    });
});
