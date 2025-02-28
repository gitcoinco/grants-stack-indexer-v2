import { Address, Bytes32String, ChainId, Hex } from "@grants-stack-indexer/shared";

export type Attestation = {
    uid: Bytes32String;
    chainId: ChainId;
    fee: bigint;
    recipient: Address;
    refUID: Bytes32String;
    projectsContributed: bigint;
    roundsContributed: bigint;
    chainIdsContributed: bigint;
    totalUSDAmount: bigint;
    timestamp: Date | null;
    metadataCid: string;
    metadata: unknown;
};

export type NewAttestation = Attestation;
export type PartialAttestation = Partial<Attestation>;

export type AttestationTxn = {
    chainId: ChainId;
    txnHash: Hex;
    attestationUid: Bytes32String;
    attestationChainId: ChainId;
};

export type AttestationTxnData = {
    chainId: ChainId;
    txnHash: Hex;
    impactImage?: string;
};

export type NewAttestationTxn = AttestationTxn;
export type PartialAttestationTxn = Partial<AttestationTxn>;
