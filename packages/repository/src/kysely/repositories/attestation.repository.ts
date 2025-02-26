import { Kysely } from "kysely";

import { stringify } from "@grants-stack-indexer/shared";

import {
    AttestationTxnData,
    Database,
    handlePostgresError,
    IAttestationRepository,
    KyselyTransaction,
    NewAttestation,
} from "../../internal.js";

export class KyselyAttestationRepository implements IAttestationRepository<KyselyTransaction> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    /* @inheritdoc */
    async insertAttestation(
        attestation: NewAttestation,
        txData: AttestationTxnData[],
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            let queryBuilder = (tx || this.db).withSchema(this.schemaName);

            // Insert the attestation
            await queryBuilder
                .insertInto("attestations")
                .values(this.formatAttestation(attestation))
                .execute();

            queryBuilder = (tx || this.db).withSchema(this.schemaName);

            // Insert the transaction data
            if (txData.length > 0) {
                await queryBuilder
                    .insertInto("attestationTransactions")
                    .values(
                        txData.map((data) => ({
                            txnHash: data.txnHash,
                            chainId: data.chainId,
                            attestationUid: attestation.uid,
                            attestationChainId: attestation.chainId,
                        })),
                    )
                    .execute();
            }
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyAttestationRepository.name,
                methodName: "insertAttestation",
                additionalData: {
                    attestation,
                    txData,
                },
            });
        }
    }

    private formatAttestation(attestation: NewAttestation): NewAttestation {
        if (attestation.metadata && Array.isArray(attestation.metadata)) {
            attestation.metadata = stringify(attestation.metadata);
        }
        return attestation;
    }
}
