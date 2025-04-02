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
    ) {
        this.dependencies.logger?.debug("Initializing OnAttestedHandler", {
            className: "OnAttestedHandler",
            chainId: this.chainId,
            attestationId: this.event.params.uid,
            blockNumber: this.event.blockNumber,
        });
    }

    async handle(): Promise<Changeset[]> {
        const { metadataProvider, logger } = this.dependencies;
        const { fee, refUID, recipient: _recipient, data } = this.event.params;
        const attestationId = this.event.params.uid;
        const recipient = getAddress(_recipient);

        logger?.debug("Starting attestation handling", {
            className: "OnAttestedHandler",
            methodName: "handle",
            attestationId,
            recipient,
            refUID,
            fee: fee.toString(),
        });

        logger?.debug("Decoding attestation data", {
            className: "OnAttestedHandler",
            methodName: "handle",
            attestationId,
            dataLength: data.length,
        });

        const decodedAttestationData = decodeAttestedData(data);

        logger?.debug("Fetching attestation metadata", {
            className: "OnAttestedHandler",
            methodName: "handle",
            attestationId,
            metadataCid: decodedAttestationData.metadataCid,
        });

        let attestationMetadata = await metadataProvider.getMetadata<
            AttestationMetadata[] | undefined
        >(decodedAttestationData.metadataCid);

        logger?.debug("Processing attestation metadata", {
            className: "OnAttestedHandler",
            methodName: "handle",
            attestationId,
            hasMetadata: !!attestationMetadata,
            metadataLength: attestationMetadata?.length ?? 0,
        });

        if (attestationMetadata === null || attestationMetadata === undefined) {
            logger?.debug("No metadata found, defaulting to empty array", {
                className: "OnAttestedHandler",
                methodName: "handle",
                attestationId,
            });
            attestationMetadata = [];
        }

        const transactionsData: AttestationTxnData[] = [];
        logger?.debug("Processing transaction metadata", {
            className: "OnAttestedHandler",
            methodName: "handle",
            attestationId,
            metadataCount: attestationMetadata.length,
        });

        for (let i = 0; i < attestationMetadata.length; i++) {
            const metadata = attestationMetadata[i]!;
            logger?.debug("Processing transaction", {
                className: "OnAttestedHandler",
                methodName: "handle",
                attestationId,
                index: i,
                chainId: metadata.chainId,
                txnHash: metadata.txnHash,
            });

            transactionsData.push({
                chainId: metadata.chainId,
                txnHash: metadata.txnHash,
            });
        }

        logger?.debug("Creating attestation data", {
            className: "OnAttestedHandler",
            methodName: "handle",
            attestationId,
            projectsCount: decodedAttestationData.projectsContributed,
            roundsCount: decodedAttestationData.roundsContributed,
            chainsCount: decodedAttestationData.chainIdsContributed,
            totalUSDAmount: decodedAttestationData.totalUSDAmount,
        });

        const attestationData: Attestation = {
            uid: attestationId,
            chainId: this.chainId,
            recipient: recipient,
            fee: BigInt(fee),
            refUID: refUID,
            projectsContributed: decodedAttestationData.projectsContributed,
            roundsContributed: decodedAttestationData.roundsContributed,
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

        logger?.info("Attestation processing completed", {
            className: "OnAttestedHandler",
            methodName: "handle",
            attestationId,
            transactionsCount: transactionsData.length,
            changeCount: changes.length,
        });

        return changes;
    }
}
