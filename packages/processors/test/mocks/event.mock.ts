import {
    ChainId,
    ContractToEventName,
    DeepPartial,
    EventParams,
    Hex,
    mergeDeep,
    ProcessorEvent,
} from "@grants-stack-indexer/shared";

/**
 * Creates a mock event for testing.
 *
 * @param eventName - The name of the event.
 * @param params - The parameters of the event.
 * @param strategyId - The ID of the strategy.
 * @param overrides - The overrides for the event.
 * @returns A mock event.
 *
 * @default
 *      srcAddress: "0x1234567890123456789012345678901234567890",
 *      blockNumber: 118034410,
 *      blockTimestamp: 1000000000,
 *      chainId: 10 as ChainId,
 *      contractName: "Strategy",
 *      logIndex: 1,
 *      transactionFields: {
 *          hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
 *          transactionIndex: 1,
 *          from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
 *      },
 */
export const createMockEvent = <T extends ContractToEventName<"Strategy">>(
    eventName: T,
    params: EventParams<"Strategy", T>,
    strategyId: Hex,
    overrides: DeepPartial<ProcessorEvent<"Strategy", T>> = {},
): ProcessorEvent<"Strategy", T> => {
    const defaultEvent: ProcessorEvent<"Strategy", T> = {
        eventName,
        params,
        srcAddress: "0x1234567890123456789012345678901234567890",
        blockNumber: 118034410,
        blockTimestamp: 1000000000,
        chainId: 10 as ChainId,
        contractName: "Strategy",
        logIndex: 1,
        transactionFields: {
            hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
            transactionIndex: 1,
            from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        strategyId,
    };

    return mergeDeep(defaultEvent, overrides);
};
