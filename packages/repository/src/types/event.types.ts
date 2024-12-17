import { AnyEvent, ChainId, ContractName, ProcessorEvent } from "@grants-stack-indexer/shared";

export type ProcessedEvent = {
    chainId: ChainId;
    blockNumber: number;
    blockTimestamp: number;
    logIndex: number;
    rawEvent?: Partial<ProcessorEvent<ContractName, AnyEvent>>;
};

export type NewProcessedEvent = Omit<ProcessedEvent, "chainId">;
