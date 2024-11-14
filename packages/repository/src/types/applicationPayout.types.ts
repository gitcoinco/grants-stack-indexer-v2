import { Address, ChainId, Hex } from "@grants-stack-indexer/shared";

export type ApplicationPayout = {
    id: number;
    chainId: ChainId;
    roundId: string;
    applicationId: string;
    amount: bigint;
    tokenAddress: Address;
    amountInUsd: string;
    amountInRoundMatchToken: bigint;
    transactionHash: Hex;
    sender: Address;
    timestamp: Date | null;
};

export type NewApplicationPayout = Omit<ApplicationPayout, "id">;
