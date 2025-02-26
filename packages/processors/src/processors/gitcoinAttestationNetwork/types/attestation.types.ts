import { AttestationTxnData } from "@grants-stack-indexer/repository";

export type GitcoinAttestedData = {
    projectsContributed: bigint;
    roundsCountributed: bigint;
    chainIdsContributed: bigint;
    totalUSDAmount: bigint;
    timestamp: bigint;
    metadataCid: string;
};

export type AttestationProjectData = {
    id: string;
    title: string;
    anchor: string;
    applicationId: string;
    applicationCId: string;
    payoutAddress: string;
    roundId: number;
    strategy: string;
    amountInUSD: bigint;
    amount: bigint;
    token: string;
};

export type AttestationMetadata = AttestationTxnData & {
    projects: AttestationProjectData[];
};
