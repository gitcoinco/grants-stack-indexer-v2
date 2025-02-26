import { Address, ChainId } from "@grants-stack-indexer/shared";

export type ApplicationStatus = "PENDING" | "REJECTED" | "APPROVED";

export type StatusSnapshot = {
    status: ApplicationStatus;
    updatedAtBlock: string;
    updatedAt: Date;
};

export type Application = {
    id: string;
    chainId: ChainId;
    roundId: Address | string;
    projectId: string;
    anchorAddress: Address | null;
    status: ApplicationStatus;
    statusSnapshots: StatusSnapshot[];
    distributionTransaction: string | null;
    metadataCid: string | null;
    metadata: unknown | null;
    createdByAddress: Address;
    createdAtBlock: bigint;
    statusUpdatedAtBlock: bigint;
    totalDonationsCount: number;
    totalAmountDonatedInUsd: number;
    uniqueDonorsCount: number;
    timestamp: Date;
    tags: string[];
};

export type NewApplication = Application;
export type PartialApplication = Partial<Application>;
