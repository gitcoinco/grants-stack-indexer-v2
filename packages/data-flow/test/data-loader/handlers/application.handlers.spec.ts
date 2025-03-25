import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    IApplicationRepository,
    NewApplication,
    TransactionConnection,
} from "@grants-stack-indexer/repository";
import { ChainId } from "@grants-stack-indexer/shared";

import { createApplicationHandlers } from "../../../src/data-loader/handlers/application.handlers.js";

describe("Application Handlers", () => {
    const mockRepository = {
        insertApplication: vi.fn(),
        updateApplication: vi.fn(),
        incrementApplicationDonationStats: vi.fn(),
    } as unknown as IApplicationRepository;
    const mockTxConnection = { query: vi.fn() } as unknown as TransactionConnection;

    const handlers = createApplicationHandlers(mockRepository);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handle InsertApplication changeset", async () => {
        const application = { id: "1", name: "Test Application" } as unknown as NewApplication;
        await handlers.InsertApplication({
            type: "InsertApplication",
            args: application,
        });

        expect(mockRepository.insertApplication).toHaveBeenCalledWith(application, undefined);
    });

    it("handle UpdateApplication changeset", async () => {
        const update = {
            type: "UpdateApplication",
            args: {
                chainId: 1 as ChainId,
                roundId: "round1",
                applicationId: "app1",
                application: { status: "APPROVED" },
            },
        } as const;

        await handlers.UpdateApplication(update, mockTxConnection);

        expect(mockRepository.updateApplication).toHaveBeenCalledWith(
            { chainId: 1, roundId: "round1", id: "app1" },
            { status: "APPROVED" },
            mockTxConnection,
        );
    });

    it("handle IncrementApplicationDonationStats changeset", async () => {
        const changeset = {
            type: "IncrementApplicationDonationStats",
            args: {
                chainId: 1 as ChainId,
                roundId: "round1",
                applicationId: "0",
                amountInUsd: "1000",
            },
        } as const;

        await handlers.IncrementApplicationDonationStats(changeset);

        expect(mockRepository.incrementApplicationDonationStats).toHaveBeenCalledWith(
            { chainId: 1 as ChainId, roundId: "round1", id: "0" },
            "1000",
            undefined,
        );
    });
});
