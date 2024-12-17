import { describe, expect, it, vi } from "vitest";

import {
    IEventRegistryRepository,
    NewProcessedEvent,
    ProcessedEvent,
} from "@grants-stack-indexer/repository";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { DatabaseEventRegistry } from "../../src/registries/event/dbEventRegistry.js";

describe("DatabaseEventRegistry", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    const mockEventRepository: IEventRegistryRepository = {
        getLastProcessedEvent: vi.fn(),
        saveLastProcessedEvent: vi.fn(),
    };

    const chainId = 1 as ChainId;

    it("return undefined for non-existent last processed event", async () => {
        const registry = new DatabaseEventRegistry(logger, mockEventRepository);

        vi.mocked(mockEventRepository.getLastProcessedEvent).mockResolvedValue(undefined);

        const event = await registry.getLastProcessedEvent(chainId);
        expect(event).toBeUndefined();
        expect(mockEventRepository.getLastProcessedEvent).toHaveBeenCalledWith(chainId);
    });

    it("return last processed event when it exists", async () => {
        const registry = new DatabaseEventRegistry(logger, mockEventRepository);
        const mockEvent: ProcessedEvent = {
            chainId,
            blockNumber: 100,
            blockTimestamp: 1234567890,
            logIndex: 1,
        };

        vi.mocked(mockEventRepository.getLastProcessedEvent).mockResolvedValue(mockEvent);

        const event = await registry.getLastProcessedEvent(chainId);
        expect(event).toEqual(mockEvent);
        expect(mockEventRepository.getLastProcessedEvent).toHaveBeenCalledWith(chainId);
    });

    it("save last processed event", async () => {
        const registry = new DatabaseEventRegistry(logger, mockEventRepository);
        const newEvent: NewProcessedEvent = {
            blockNumber: 100,
            blockTimestamp: 1234567890,
            logIndex: 1,
        };

        vi.mocked(mockEventRepository.saveLastProcessedEvent).mockResolvedValue();

        await registry.saveLastProcessedEvent(chainId, newEvent);
        expect(mockEventRepository.saveLastProcessedEvent).toHaveBeenCalledWith(chainId, newEvent);
    });
});
