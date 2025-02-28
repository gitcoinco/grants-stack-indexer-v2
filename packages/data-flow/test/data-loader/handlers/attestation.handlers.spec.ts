import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    AttestationTxnData,
    IAttestationRepository,
    NewAttestation,
    TransactionConnection,
} from "@grants-stack-indexer/repository";

import { createAttestationHandlers } from "../../../src/data-loader/handlers/attestation.handlers.js";

describe("Attestation Handlers", () => {
    const mockRepository = {
        insertAttestation: vi.fn(),
    } as IAttestationRepository;
    const mockTxConnection = { query: vi.fn() } as unknown as TransactionConnection;

    const handlers = createAttestationHandlers(mockRepository);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handle InsertAttestation changeset", async () => {
        const attestation = {
            id: "1",
            name: "Test Attestation",
        } as unknown as NewAttestation;

        const transactionsData = [
            {
                id: "1",
                name: "Test Transaction",
            } as unknown as AttestationTxnData,
        ];

        await handlers.InsertAttestation(
            {
                type: "InsertAttestation",
                args: { attestationData: attestation, transactionsData },
            },
            mockTxConnection,
        );

        expect(mockRepository.insertAttestation).toHaveBeenCalledWith(
            attestation,
            transactionsData,
            mockTxConnection,
        );
    });
});
