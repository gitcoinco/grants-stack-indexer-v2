import type {
    Address,
    AlloEvent,
    EventParams,
    IndexerFetchedEvent,
    RegistryEvent,
    StrategyEvent,
    TimestampMs,
} from "@grants-stack-indexer/shared";

export const DEFAULT_SRC_ADDRESS = "0x3075bE2EdD29E1b1886c332193239ae321f434Bf" as const;
export const DEFAULT_FROM_ADDRESS = "0x9511f02B36e6712971c77A91943D4ca7604C6e10" as const;
export const DEFAULT_TX_HASH =
    "0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162" as const;
export const DEFAULT_TIMESTAMP_MS = 1701472394000 as TimestampMs;
export const DEFAULT_BLOCK_NUMBER = 170147 as const;

export const createTestAlloEvent = <E extends AlloEvent>({
    contractName,
    eventName,
    params,
    blockNumber = DEFAULT_BLOCK_NUMBER,
    blockTimestamp = DEFAULT_TIMESTAMP_MS,
    srcAddress = DEFAULT_SRC_ADDRESS,
    logIndex = 0,
    chainId = 1,
    from = DEFAULT_FROM_ADDRESS,
    txIndex = 0,
}: {
    contractName: "Allo";
    eventName: E;
    params: EventParams<"Allo", E>;
    blockNumber?: number;
    blockTimestamp?: TimestampMs;
    srcAddress?: Address;
    logIndex?: number;
    chainId?: number;
    from?: Address;
    txIndex?: number;
}): IndexerFetchedEvent<"Allo", E> => {
    return {
        contractName,
        eventName,
        params,
        blockNumber,
        blockTimestamp,
        logIndex,
        chainId,
        srcAddress,
        transactionFields: {
            hash: DEFAULT_TX_HASH,
            transactionIndex: txIndex,
            from,
        },
    };
};

export const createTestRegistryEvent = <E extends RegistryEvent>({
    eventName,
    params,
    blockNumber = DEFAULT_BLOCK_NUMBER,
    blockTimestamp = DEFAULT_TIMESTAMP_MS,
    logIndex = 0,
    chainId = 1,
    srcAddress = DEFAULT_SRC_ADDRESS,
    from = DEFAULT_FROM_ADDRESS,
    txIndex = 0,
}: {
    eventName: E;
    params: EventParams<"Registry", E>;
    blockNumber?: number;
    blockTimestamp?: TimestampMs;
    logIndex?: number;
    chainId?: number;
    srcAddress?: Address;
    from?: Address;
    txIndex?: number;
}): IndexerFetchedEvent<"Registry", E> => {
    return {
        contractName: "Registry",
        eventName,
        params,
        blockNumber,
        blockTimestamp,
        logIndex,
        chainId,
        srcAddress,
        transactionFields: {
            hash: DEFAULT_TX_HASH,
            transactionIndex: txIndex,
            from,
        },
    };
};

export const createTestStrategyEvent = <E extends StrategyEvent>({
    eventName,
    params,
    blockNumber,
    blockTimestamp = DEFAULT_TIMESTAMP_MS,
    logIndex = 0,
    chainId = 1,
    srcAddress = DEFAULT_SRC_ADDRESS,
    from = DEFAULT_FROM_ADDRESS,
    txIndex = 0,
}: {
    eventName: E;
    params: EventParams<"Strategy", E>;
    blockNumber: number;
    blockTimestamp?: TimestampMs;
    logIndex?: number;
    chainId?: number;
    srcAddress?: Address;
    from?: Address;
    txIndex?: number;
}): IndexerFetchedEvent<"Strategy", E> => {
    return {
        contractName: "Strategy",
        eventName,
        params,
        blockNumber,
        blockTimestamp,
        logIndex,
        chainId,
        srcAddress,
        transactionFields: {
            hash: DEFAULT_TX_HASH,
            transactionIndex: txIndex,
            from,
        },
    };
};
