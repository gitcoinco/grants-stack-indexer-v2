import { AnyEvent, ChainId } from "@grants-stack-indexer/shared";

export type ProcessedEvent = {
    chainId: ChainId;
    blockNumber: number;
    blockTimestamp: number;
    logIndex: number;
    rawEvent?: AnyEvent;
};

export type NewProcessedEvent = Omit<ProcessedEvent, "chainId">;
