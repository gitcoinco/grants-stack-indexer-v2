import { AttestationTxnData, NewAttestation, TransactionConnection } from "../internal.js";

export interface IAttestationRepository<
    TxConnection extends TransactionConnection = TransactionConnection,
> {
    /**
     * Inserts a new attestation into the repository.
     * @param attestation The new attestation to insert.
     * @param txData The transaction data for the attestation.
     * @param tx Optional transaction connection
     * @returns A promise that resolves when the insertion is complete.
     */
    insertAttestation(
        attestation: NewAttestation,
        txData: AttestationTxnData[],
        tx?: TxConnection,
    ): Promise<void>;
}
