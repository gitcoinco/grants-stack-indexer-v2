import { getAddress } from "viem";

import { Attestation, AttestationTxnData, Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getDateFromTimestamp, IEventHandler, ProcessorDependencies } from "../../../internal.js";
import { decodeAttestedData } from "../helpers/index.js";
import { AttestationMetadata } from "../types/index.js";

type Dependencies = Pick<ProcessorDependencies, "metadataProvider" | "logger">;

/**
 * Handles the OnAttested event for the GitcoinAttestationNetwork protocol.
 *
 * This handler performs the following core actions when an attested event is received:
 * - Decodes the attested data
 * - Fetches the attestation metadata
 * - Returns the changeset to insert the attestation and transactions data.
 */
export class OnAttestedHandler implements IEventHandler<"GitcoinAttestationNetwork", "OnAttested"> {
    constructor(
        readonly event: ProcessorEvent<"GitcoinAttestationNetwork", "OnAttested">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    async handle(): Promise<Changeset[]> {
        const { metadataProvider } = this.dependencies;
        const { fee, refUID, recipient: _recipient, data } = this.event.params;
        const attestationId = this.event.params.uid;
        const recipient = getAddress(_recipient);

        const decodedAttestationData = decodeAttestedData(data);

        let attestationMetadata = await metadataProvider.getMetadata<
            AttestationMetadata[] | undefined
        >(decodedAttestationData.metadataCid);

        if (attestationMetadata === null || attestationMetadata === undefined) {
            attestationMetadata = [];
        }

        const transactionsData: AttestationTxnData[] = [];
        for (let i = 0; i < attestationMetadata.length; i++) {
            const metadata = attestationMetadata[i]!;

            transactionsData.push({
                chainId: metadata.chainId,
                txnHash: metadata.txnHash,
            });
        }

        const attestationData: Attestation = {
            uid: attestationId,
            chainId: this.chainId,
            recipient: recipient,
            fee: BigInt(fee),
            refUID: refUID,
            projectsContributed: decodedAttestationData.projectsContributed,
            roundsContributed: decodedAttestationData.roundsCountributed,
            chainIdsContributed: decodedAttestationData.chainIdsContributed,
            totalUSDAmount: decodedAttestationData.totalUSDAmount,
            timestamp: getDateFromTimestamp(decodedAttestationData.timestamp),
            metadataCid: decodedAttestationData.metadataCid,
            metadata: attestationMetadata,
        };

        const changes: Changeset[] = [
            {
                type: "InsertAttestation",
                args: {
                    attestationData,
                    transactionsData,
                },
            },
        ];

        return changes;
    }
}
