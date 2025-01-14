import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    IApplicationPayoutRepository,
    NewApplicationPayout,
    TransactionConnection,
} from "@grants-stack-indexer/repository";

import { createApplicationPayoutHandlers } from "../../../src/data-loader/handlers/applicationPayout.handlers.js";

describe("ApplicationPayout Handlers", () => {
    const mockRepository = {
        insertApplicationPayout: vi.fn(),
    } as IApplicationPayoutRepository;
    const mockTxConnection = { query: vi.fn() } as unknown as TransactionConnection;

    const handlers = createApplicationPayoutHandlers(mockRepository);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handle InsertApplication changeset", async () => {
        const applicationPayout = {
            id: "1",
            name: "Test Application",
        } as unknown as NewApplicationPayout;

        await handlers.InsertApplicationPayout(
            {
                type: "InsertApplicationPayout",
                args: { applicationPayout },
            },
            mockTxConnection,
        );

        expect(mockRepository.insertApplicationPayout).toHaveBeenCalledWith(
            applicationPayout,
            mockTxConnection,
        );
    });
});
