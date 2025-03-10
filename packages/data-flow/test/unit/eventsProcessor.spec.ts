import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    AlloProcessor,
    AlloV1ToV2ProfileMigrationProcessor,
    GitcoinAttestationNetworkProcessor,
    ProcessorDependencies,
    RegistryProcessor,
    StrategyProcessor,
} from "@grants-stack-indexer/processors";
import { Attestation, AttestationTxnData, Changeset } from "@grants-stack-indexer/repository";
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
    AlloV1ToV2ProfileMigrationProcessor: vi.fn(),
    GitcoinAttestationNetworkProcessor: vi.fn(),
}));

describe("EventsProcessor", () => {
    let eventsProcessor: EventsProcessor;
    let mockAlloProcessor: AlloProcessor;
    let mockRegistryProcessor: RegistryProcessor;
    let mockStrategyProcessor: StrategyProcessor;
    let mockAlloV1ToV2ProfileMigrationProcessor: AlloV1ToV2ProfileMigrationProcessor;
    let mockGitcoinAttestationNetworkProcessor: GitcoinAttestationNetworkProcessor;
    const chainId = 1 as ChainId;
    const mockDependencies = {} as ProcessorDependencies;

    beforeEach(() => {
        mockAlloProcessor = { process: vi.fn() } as unknown as AlloProcessor;
        mockRegistryProcessor = { process: vi.fn() } as unknown as RegistryProcessor;
        mockStrategyProcessor = { process: vi.fn() } as unknown as StrategyProcessor;
        mockAlloV1ToV2ProfileMigrationProcessor = {
            process: vi.fn(),
        } as unknown as AlloV1ToV2ProfileMigrationProcessor;
        mockGitcoinAttestationNetworkProcessor = {
            process: vi.fn(),
        } as unknown as GitcoinAttestationNetworkProcessor;
        vi.mocked(AlloProcessor).mockImplementation(() => mockAlloProcessor);
        vi.mocked(RegistryProcessor).mockImplementation(() => mockRegistryProcessor);
        vi.mocked(StrategyProcessor).mockImplementation(() => mockStrategyProcessor);
        vi.mocked(AlloV1ToV2ProfileMigrationProcessor).mockImplementation(
            () => mockAlloV1ToV2ProfileMigrationProcessor,
        );
        vi.mocked(GitcoinAttestationNetworkProcessor).mockImplementation(
            () => mockGitcoinAttestationNetworkProcessor,
        );
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

    it("process AlloV1ToV2ProfileMigration events using AlloV1ToV2ProfileMigrationProcessor", async () => {
        const v1ChainId = 1 as ChainId;
        const v1ProjectId = "1";
        const v2ProjectId = "2";
        const mockChangeset: Changeset[] = [
            {
                type: "InsertLegacyProject",
                args: { legacyProject: { v1ChainId, v1ProjectId, v2ProjectId } },
            },
        ];
        const mockEvent = {
            contractName: "AlloV1ToV2ProfileMigration",
            eventName: "ProfileMigrated",
            args: { v1ChainId, v1ProjectId, v2ProjectId },
        } as unknown as ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated">;

        vi.spyOn(mockAlloV1ToV2ProfileMigrationProcessor, "process").mockResolvedValue(
            mockChangeset,
        );

        const result = await eventsProcessor.processEvent(mockEvent);

        expect(mockAlloV1ToV2ProfileMigrationProcessor.process).toHaveBeenCalledWith(mockEvent);
        expect(result).toBe(mockChangeset);
    });

    it("process GitcoinAttestationNetwork events using GitcoinAttestationNetworkProcessor", async () => {
        const mockChangeset: Changeset[] = [
            {
                type: "InsertAttestation",
                args: {
                    attestationData: {} as Attestation,
                    transactionsData: [] as AttestationTxnData[],
                },
            },
        ];
        const mockEvent = {
            contractName: "GitcoinAttestationNetwork",
            eventName: "OnAttested",
            args: {},
        } as unknown as ProcessorEvent<"GitcoinAttestationNetwork", "OnAttested">;

        vi.spyOn(mockGitcoinAttestationNetworkProcessor, "process").mockResolvedValue(
            mockChangeset,
        );

        const result = await eventsProcessor.processEvent(mockEvent);

        expect(mockGitcoinAttestationNetworkProcessor.process).toHaveBeenCalledWith(mockEvent);
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
