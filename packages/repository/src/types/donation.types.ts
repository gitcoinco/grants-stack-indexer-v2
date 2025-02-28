import { Address, ChainId, Hex } from "@grants-stack-indexer/shared";

export type Donation = {
    id: string;
    chainId: ChainId;
    roundId: Address | string;
    applicationId: string | null;
    donorAddress: Address;
    recipientAddress: Address;
    projectId: string;
    transactionHash: Hex;
    blockNumber: bigint;
    tokenAddress: Address;
    amount: bigint;
    amountInUsd: string;
    amountInRoundMatchToken: bigint;
    timestamp: Date;
};

export type NewDonation = Donation;
