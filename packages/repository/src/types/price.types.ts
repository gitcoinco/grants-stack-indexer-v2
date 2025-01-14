import { TokenCode } from "@grants-stack-indexer/shared";

export type Price = {
    tokenCode: TokenCode;
    timestampMs: number;
    priceUsd: number;
    createdAt: Date;
};

export type NewPrice = Omit<Price, "createdAt">;
export type PartialPrice = Partial<Price>;
