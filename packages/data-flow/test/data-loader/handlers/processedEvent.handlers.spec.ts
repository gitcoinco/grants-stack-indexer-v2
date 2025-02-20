import { describe, expect, it, vi } from "vitest";

import { IEventRegistryRepository, TransactionConnection } from "@grants-stack-indexer/repository";
import { ChainId } from "@grants-stack-indexer/shared";

import { createProcessedEventHandlers } from "../../../src/data-loader/handlers/processedEvent.handlers.js";

describe("ProcessedEvent Handlers", () => {
    const chainId = 1 as ChainId;
    const mockEvent = {
        blockNumber: 1,
        blockTimestamp: 1234567890,
        logIndex: 0,
        rawEvent: {},
    };

    describe("InsertProcessedEvent", () => {
        it("saves event to repository within transaction", async () => {
            const saveLastProcessedEvent = vi.fn();
            const mockRepository = {
                saveLastProcessedEvent,
                getLastProcessedEvent: vi.fn(),
            } as unknown as IEventRegistryRepository<TransactionConnection>;

            const handlers = createProcessedEventHandlers(mockRepository);

            const mockTx = {} as TransactionConnection;

            await handlers.InsertProcessedEvent(
                {
                    type: "InsertProcessedEvent",
                    args: {
                        chainId,
                        processedEvent: mockEvent,
                    },
                },
                mockTx,
            );

            expect(saveLastProcessedEvent).toHaveBeenCalledWith(chainId, mockEvent, mockTx);
        });

        it("propagates repository errors", async () => {
            const error = new Error("Database error");
            const saveLastProcessedEvent = vi.fn().mockRejectedValue(error);
            const mockRepository = {
                saveLastProcessedEvent,
                getLastProcessedEvent: vi.fn(),
            } as unknown as IEventRegistryRepository<TransactionConnection>;

            const handlers = createProcessedEventHandlers(mockRepository);

            const mockTx = {} as TransactionConnection;

            await expect(
                handlers.InsertProcessedEvent(
                    {
                        type: "InsertProcessedEvent",
                        args: {
                            chainId,
                            processedEvent: mockEvent,
                        },
                    },
                    mockTx,
                ),
            ).rejects.toThrow(error);
        });
    });
});
