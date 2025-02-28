import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    Changeset,
    IApplicationPayoutRepository,
    IApplicationRepository,
    IAttestationRepository,
    IDonationRepository,
    IEventRegistryRepository,
    ILegacyProjectRepository,
    IProjectRepository,
    IRoundRepository,
    ITransactionManager,
    TransactionConnection,
} from "@grants-stack-indexer/repository";
import { ILogger } from "@grants-stack-indexer/shared";

import { DataLoader } from "../../src/data-loader/dataLoader.js";
import { InvalidChangeset } from "../../src/internal.js";

describe("DataLoader", () => {
    let dataLoader: DataLoader;
    const mockProjectRepository = {
        insertProject: vi.fn(),
        updateProject: vi.fn(),
    } as unknown as IProjectRepository;

    const mockRoundRepository = {
        insertRound: vi.fn(),
        updateRound: vi.fn(),
    } as unknown as IRoundRepository;

    const mockApplicationRepository = {
        insertApplication: vi.fn(),
        updateApplication: vi.fn(),
    } as unknown as IApplicationRepository;

    const mockDonationRepository = {
        insertDonation: vi.fn(),
        insertManyDonations: vi.fn(),
    } as IDonationRepository;

    const mockApplicationPayoutRepository = {
        insertApplicationPayout: vi.fn(),
    } as IApplicationPayoutRepository;

    const mockEventRegistryRepository = {
        saveLastProcessedEvent: vi.fn(),
    } as unknown as IEventRegistryRepository;

    const mockAttestationRepository = {
        insertAttestation: vi.fn(),
    } as unknown as IAttestationRepository;
    const mockLegacyProjectRepository = {
        insertLegacyProject: vi.fn(),
    } as unknown as ILegacyProjectRepository;

    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    const mockTx = { query: vi.fn() } as unknown as TransactionConnection;
    const mockTransactionManager = {
        runInTransaction: async (fn) => await fn(mockTx),
    } as ITransactionManager;

    beforeEach(() => {
        dataLoader = new DataLoader(
            {
                project: mockProjectRepository,
                round: mockRoundRepository,
                application: mockApplicationRepository,
                donation: mockDonationRepository,
                applicationPayout: mockApplicationPayoutRepository,
                eventRegistry: mockEventRegistryRepository,
                attestation: mockAttestationRepository,
                legacyProject: mockLegacyProjectRepository,
            },
            mockTransactionManager,
            logger,
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("applyChanges", () => {
        it("successfully process multiple changesets", async () => {
            const changesets = [
                {
                    type: "InsertProject",
                    args: { project: { id: "1", name: "Test Project" } },
                } as unknown as Changeset,
                {
                    type: "InsertRound",
                    args: { round: { id: "1", name: "Test Round" } },
                } as unknown as Changeset,
            ];

            await dataLoader.applyChanges(changesets);

            expect(mockProjectRepository.insertProject).toHaveBeenCalledTimes(1);
            expect(mockProjectRepository.insertProject).toHaveBeenCalledWith(
                { id: "1", name: "Test Project" },
                mockTx,
            );
            expect(mockRoundRepository.insertRound).toHaveBeenCalledTimes(1);
            expect(mockRoundRepository.insertRound).toHaveBeenCalledWith(
                { id: "1", name: "Test Round" },
                mockTx,
            );
        });

        it("throw InvalidChangeset when encountering unknown changeset type", async () => {
            const changesets = [
                {
                    type: "UnknownType",
                    args: {},
                } as unknown as Changeset,
            ];
            await expect(() => dataLoader.applyChanges(changesets)).rejects.toThrow(
                InvalidChangeset,
            );
        });

        it("throws an error if the database operation fails", async () => {
            const error = new Error("Database error");
            vi.spyOn(mockProjectRepository, "insertProject").mockRejectedValueOnce(error);

            const changesets = [
                {
                    type: "InsertProject",
                    args: { project: { id: "1" } },
                } as unknown as Changeset,
                {
                    type: "InsertRound" as const,
                    args: { round: { id: "1" } },
                } as unknown as Changeset,
            ];

            await expect(dataLoader.applyChanges(changesets)).rejects.toThrow(error);

            expect(logger.debug).toHaveBeenLastCalledWith(
                `Error applying changeset InsertProject. Rolling back transaction with 2 changesets`,
                {
                    className: DataLoader.name,
                },
            );
            expect(mockRoundRepository.insertRound).not.toHaveBeenCalled();
        });
    });
});
