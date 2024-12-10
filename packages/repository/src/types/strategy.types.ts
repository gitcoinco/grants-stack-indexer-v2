import { Address, ChainId, Hex } from "@grants-stack-indexer/shared";

export type Strategy = {
    address: Address;
    id: Hex;
    chainId: ChainId;
    handled: boolean;
};

export type NewStrategy = Strategy;
