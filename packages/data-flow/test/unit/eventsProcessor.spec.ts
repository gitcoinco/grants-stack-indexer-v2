import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    AlloProcessor,
    ProcessorDependencies,
    RegistryProcessor,
    StrategyProcessor,
} from "@grants-stack-indexer/processors";
import { Changeset } from "@grants-stack-indexer/repository";
import {
    AnyEvent,
    ChainId,
    ContractName,
    ProcessorEvent,
    TimestampMs,
} from "@grants-stack-indexer/shared";

import { EventsProcessor } from "../../src/eventsProcessor.js";
import { InvalidEvent } from "../../src/exceptions/index.js";

vi.mock("@grants-stack-indexer/processors", () => ({
    AlloProcessor: vi.fn(),
    RegistryProcessor: vi.fn(),
    StrategyProcessor: vi.fn(),
}));

describe("EventsProcessor", () => {
    let eventsProcessor: EventsProcessor;
    let mockAlloProcessor: AlloProcessor;
    let mockRegistryProcessor: RegistryProcessor;
    let mockStrategyProcessor: StrategyProcessor;
    const chainId = 1 as ChainId;
    const mockDependencies = {} as ProcessorDependencies;

    beforeEach(() => {
        mockAlloProcessor = { process: vi.fn() } as unknown as AlloProcessor;
        mockRegistryProcessor = { process: vi.fn() } as unknown as RegistryProcessor;
        mockStrategyProcessor = { process: vi.fn() } as unknown as StrategyProcessor;

        vi.mocked(AlloProcessor).mockImplementation(() => mockAlloProcessor);
        vi.mocked(RegistryProcessor).mockImplementation(() => mockRegistryProcessor);
        vi.mocked(StrategyProcessor).mockImplementation(() => mockStrategyProcessor);

        eventsProcessor = new EventsProcessor(chainId, mockDependencies);
    });

    it("process Allo events using AlloProcessor", async () => {
        const mockChangeset: Changeset[] = [
            { type: "UpdateProject", args: { chainId, projectId: "1", project: {} } },
        ];
        const mockEvent = {
            contractName: "Allo",
            eventName: "PoolCreated",
            args: {},
        } as unknown as ProcessorEvent<"Allo", "PoolCreated">;

        vi.spyOn(mockAlloProcessor, "process").mockResolvedValue(mockChangeset);

        const result = await eventsProcessor.processEvent(mockEvent);

        expect(mockAlloProcessor.process).toHaveBeenCalledWith(mockEvent);
        expect(result).toBe(mockChangeset);
    });

    it("process Registry events using RegistryProcessor", async () => {
        const mockChangeset: Changeset[] = [
            { type: "UpdateProject", args: { chainId, projectId: "1", project: {} } },
        ];
        const mockEvent = {
            contractName: "Registry",
            eventName: "ProfileCreated",
            args: {},
        } as unknown as ProcessorEvent<"Registry", "ProfileCreated">;

        vi.spyOn(mockRegistryProcessor, "process").mockResolvedValue(mockChangeset);

        const result = await eventsProcessor.processEvent(mockEvent);

        expect(mockRegistryProcessor.process).toHaveBeenCalledWith(mockEvent);
        expect(result).toBe(mockChangeset);
    });

    it("process Strategy events using StrategyProcessor", async () => {
        const mockChangeset: Changeset[] = [
            { type: "UpdateRound", args: { chainId, roundId: "1", round: {} } },
        ];
        const mockEvent = {
            contractName: "Strategy",
            eventName: "DistributedWithRecipientAddress",
            args: {},
        } as unknown as ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">;

        vi.spyOn(mockStrategyProcessor, "process").mockResolvedValue(mockChangeset);

        const result = await eventsProcessor.processEvent(mockEvent);

        expect(mockStrategyProcessor.process).toHaveBeenCalledWith(mockEvent);
        expect(result).toBe(mockChangeset);
    });

    it("throw InvalidEvent for unknown event types", async () => {
        const mockEvent: ProcessorEvent<ContractName, AnyEvent> = {
            contractName: "Unknown" as unknown as ContractName,
            eventName: "PoolCreated",
            blockNumber: 1,
            blockTimestamp: 1704067241331 as TimestampMs,
            chainId,
            logIndex: 1,
            srcAddress: "0x0",
            params: {
                sender: "0x0",
                recipientAddress: "0x0",
                recipientId: "0x0",
                amount: "1",
            },
            transactionFields: {
                hash: "0x0",
                transactionIndex: 1,
            },
        };

        await expect(eventsProcessor.processEvent(mockEvent)).rejects.toThrow(InvalidEvent);
    });
});
