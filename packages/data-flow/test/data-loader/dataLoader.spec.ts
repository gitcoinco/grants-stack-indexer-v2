import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    Changeset,
    IApplicationRepository,
    IDonationRepository,
    IProjectRepository,
    IRoundRepository,
} from "@grants-stack-indexer/repository";

import { DataLoader } from "../../src/data-loader/dataLoader.js";
import { InvalidChangeset } from "../../src/internal.js";

describe("DataLoader", () => {
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

    const createDataLoader = (): DataLoader =>
        new DataLoader({
            project: mockProjectRepository,
            round: mockRoundRepository,
            application: mockApplicationRepository,
            donation: mockDonationRepository,
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("applyChanges", () => {
        it("successfully process multiple changesets", async () => {
            const dataLoader = createDataLoader();
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

            const result = await dataLoader.applyChanges(changesets);

            expect(result.numExecuted).toBe(2);
            expect(result.numSuccessful).toBe(2);
            expect(result.numFailed).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(mockProjectRepository.insertProject).toHaveBeenCalledTimes(1);
            expect(mockRoundRepository.insertRound).toHaveBeenCalledTimes(1);
        });

        it("throw InvalidChangeset when encountering unknown changeset type", async () => {
            const dataLoader = createDataLoader();
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

        it("stops processing changesets on first error", async () => {
            const dataLoader = createDataLoader();
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

            const result = await dataLoader.applyChanges(changesets);

            expect(result.numExecuted).toBe(1);
            expect(result.numSuccessful).toBe(0);
            expect(result.numFailed).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain("Database error");
            expect(mockRoundRepository.insertRound).not.toHaveBeenCalled();
        });
    });
});
