import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    IDonationRepository,
    NewDonation,
    TransactionConnection,
} from "@grants-stack-indexer/repository";

import { createDonationHandlers } from "../../../src/data-loader/handlers/donation.handlers.js";

describe("Donation Handlers", () => {
    const mockRepository = {
        insertDonation: vi.fn(),
        insertManyDonations: vi.fn(),
    } as IDonationRepository;
    const mockTxConnection = { query: vi.fn() } as unknown as TransactionConnection;

    const handlers = createDonationHandlers(mockRepository);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handle InsertDonation changeset", async () => {
        const donation = { id: "1", name: "Test Donation" } as unknown as NewDonation;
        await handlers.InsertDonation({
            type: "InsertDonation",
            args: { donation },
        });

        expect(mockRepository.insertDonation).toHaveBeenCalledWith(donation, undefined);
    });

    it("handle InsertManyDonations changeset", async () => {
        const donations = [
            { id: "1", name: "Test Donation" },
            { id: "2", name: "Test Donation 2" },
            { id: "3", name: "Test Donation 3" },
        ] as unknown as NewDonation[];

        await handlers.InsertManyDonations(
            {
                type: "InsertManyDonations",
                args: { donations },
            },
            mockTxConnection,
        );

        expect(mockRepository.insertManyDonations).toHaveBeenCalledWith(
            donations,
            mockTxConnection,
        );
    });
});
