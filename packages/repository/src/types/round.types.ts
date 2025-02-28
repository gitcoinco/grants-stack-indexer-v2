import { Address, ChainId } from "@grants-stack-indexer/shared";

export type MatchingDistribution = {
    applicationId: string;
    projectPayoutAddress: string;
    projectId: string;
    projectName: string;
    matchPoolPercentage: number;
    contributionsCount: number;
    originalMatchAmountInToken: string;
    matchAmountInToken: string;
};

export type Round = {
    id: Address | string;
    chainId: ChainId;
    matchAmount: bigint;
    matchTokenAddress: Address;
    matchAmountInUsd: string;
    fundedAmount: bigint;
    fundedAmountInUsd: string;
    applicationMetadataCid: string;
    applicationMetadata: unknown | null;
    roundMetadataCid: string | null;
    roundMetadata: unknown;
    applicationsStartTime: Date | null;
    applicationsEndTime: Date | null;
    donationsStartTime: Date | null;
    donationsEndTime: Date | null;
    createdByAddress: Address;
    createdAtBlock: bigint;
    updatedAtBlock: bigint;
    totalAmountDonatedInUsd: string;
    totalDonationsCount: number;
    totalDistributed: bigint;
    uniqueDonorsCount: number;
    managerRole: string;
    adminRole: string;
    strategyAddress: Address;
    strategyId: string;
    strategyName: string;
    readyForPayoutTransaction: string | null;
    matchingDistribution: MatchingDistribution[] | null;
    projectId: string;
    tags: string[];
    timestamp: Date;
};

export type NewRound = Round;
export type PartialRound = Partial<Round>;

export type RoundRoleNames = "admin" | "manager";

export type RoundRole = {
    chainId: ChainId;
    roundId: string;
    address: Address;
    role: RoundRoleNames;
    createdAtBlock: bigint;
};

export type NewRoundRole = RoundRole;
export type PartialRoundRole = Partial<RoundRole>;

// In Allo V2 rounds roles are emitted before a pool/round exists.
// The role emitted is the bytes32(poolId).
// Once a round is created we search for roles with that pool id
// and add real round roles. After that we can remove the pending round roles.
export type PendingRoundRole = {
    id?: number;
    chainId: ChainId;
    role: string;
    address: Address;
    createdAtBlock: bigint;
};

export type NewPendingRoundRole = Omit<PendingRoundRole, "id">;
export type PartialPendingRoundRole = Partial<PendingRoundRole>;
