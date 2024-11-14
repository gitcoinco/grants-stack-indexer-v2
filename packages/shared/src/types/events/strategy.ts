import { Hex } from "viem";

import { Address, AnyEvent, Bytes32String, ContractName, ProcessorEvent } from "../../internal.js";

/**
 * This array is used to represent all Strategy events.
 */
const StrategyEventArray = [
    "RegisteredWithSender",
    "RegisteredWithData",
    "DistributedWithRecipientAddress",
    "DistributedWithData",
    "DistributedWithFlowRate",
    "TimestampsUpdated",
    "TimestampsUpdatedWithRegistrationAndAllocation",
    "AllocatedWithOrigin",
    "AllocatedWithToken",
    "AllocatedWithData",
    "AllocatedWithVotes",
    "AllocatedWithStatus",
    "DistributionUpdated",
    "FundsDistributed",
    "RecipientStatusUpdatedWithApplicationId",
    "RecipientStatusUpdatedWithRecipientStatus",
    "RecipientStatusUpdatedWithFullRow",
    "UpdatedRegistrationWithStatus",
    "UpdatedRegistration",
    "UpdatedRegistrationWithApplicationId",
    "DirectAllocated",
] as const;

/**
 * This type is used to represent a Strategy events.
 */
export type StrategyEvent = (typeof StrategyEventArray)[number];

/**
 * This type maps Strategy events to their respective parameters.
 */
export type StrategyEventParams<T extends StrategyEvent> = T extends "RegisteredWithSender"
    ? RegisteredWithSenderParams
    : T extends "RegisteredWithData"
      ? RegisteredWithDataParams
      : T extends "DistributedWithRecipientAddress"
        ? DistributedWithRecipientAddressParams
        : T extends "DistributedWithData"
          ? DistributedWithDataParams
          : T extends "DistributedWithFlowRate"
            ? DistributedWithFlowRateParams
            : T extends "TimestampsUpdated"
              ? TimestampsUpdatedParams
              : T extends "TimestampsUpdatedWithRegistrationAndAllocation"
                ? TimestampsUpdatedWithRegistrationAndAllocationParams
                : T extends "AllocatedWithToken"
                  ? AllocatedWithTokenParams
                  : T extends "AllocatedWithOrigin"
                    ? AllocatedWithOriginParams
                    : T extends "AllocatedWithVotes"
                      ? AllocatedWithVotesParams
                      : T extends "DistributionUpdated"
                        ? DistributionUpdatedParams
                        : T extends "FundsDistributed"
                          ? FundsDistributedParams
                          : T extends "RecipientStatusUpdatedWithApplicationId"
                            ? RecipientStatusUpdatedWithApplicationIdParams
                            : T extends "RecipientStatusUpdatedWithRecipientStatus"
                              ? RecipientStatusUpdatedWithRecipientStatusParams
                              : T extends "RecipientStatusUpdatedWithFullRow"
                                ? RecipientStatusUpdatedWithFullRowParams
                                : T extends "UpdatedRegistrationWithStatus"
                                  ? UpdatedRegistrationWithStatusParams
                                  : T extends "UpdatedRegistration"
                                    ? UpdatedRegistrationParams
                                    : T extends "UpdatedRegistrationWithApplicationId"
                                      ? UpdatedRegistrationWithApplicationIdParams
                                      : T extends "DirectAllocated"
                                        ? DirectAllocatedParams
                                        : never;

// =============================================================================
// =============================== Event Parameters ============================
// =============================================================================

// ======================= Registered =======================
export type RegisteredWithSenderParams = {
    recipientId: Address;
    data: Hex;
    sender: Address;
};

export type RegisteredWithDataParams = {
    recipient: Address;
    data: Hex;
};

// ======================= Distributed =======================
export type DistributedWithRecipientAddressParams = {
    recipientAddress: Address;
    recipientId: Address;
    sender: Address;
    amount: string; //uint256
};

export type DistributedWithDataParams = {
    data: Hex;
    sender: Address;
};

export type DistributedWithFlowRateParams = {
    flowRate: string; //int96
    sender: Address;
};

// ======================= TimestampsUpdated =======================

export type TimestampsUpdatedParams = {
    startTime: string; //uint64
    endTime: string; //uint64
    sender: Address;
};

export type TimestampsUpdatedWithRegistrationAndAllocationParams = {
    registrationStartTime: string; //uint64
    registrationEndTime: string; //uint64
    allocationStartTime: string; //uint64
    allocationEndTime: string; //uint64
    sender: Address;
};

// ======================= FundsDistributed =======================
export type FundsDistributedParams = {
    amount: string; //uint256
    grantee: Address;
    token: Address;
    recipientId: Address;
};

// ======================= Allocated =======================
export type AllocatedWithTokenParams = {
    recipientId: Address;
    amount: string; //uint256
    token: Address;
    sender: Address;
};

export type AllocatedWithOriginParams = {
    recipientId: Address;
    amount: string; //uint256
    token: Address;
    sender: Address;
    origin: Address;
};

export type AllocatedWithVotesParams = {
    recipientId: Address;
    votes: string; //uint256
    allocator: Address;
};

export type AllocatedWithStatusParams = {
    recipientId: Address;
    status: string; //uint8
    sender: Address;
};

// ======================= DistributionUpdated =======================
export type DistributionUpdatedParams = {
    merkleRoot: Bytes32String;
    metadata: [protocol: string, pointer: string]; //uint256,bytes32
};

// ======================= RecipientStatusUpdated =======================
export type RecipientStatusUpdatedWithApplicationIdParams = {
    recipientId: Address;
    applicationId: string; //uint256
    status: string; //uint8
    sender: Address;
};

export type RecipientStatusUpdatedWithRecipientStatusParams = {
    recipientId: Address;
    status: string; //uint8
    sender: Address;
};

export type RecipientStatusUpdatedWithFullRowParams = {
    rowIndex: string; //uint256
    fullRow: string; //uint256
    sender: Address;
};

// ======================= UpdatedRegistration =======================
export type UpdatedRegistrationWithStatusParams = {
    recipientId: Address;
    data: Hex;
    sender: Address;
    status: string; //uint8
};

export type UpdatedRegistrationParams = {
    recipientId: Address;
    data: Hex;
    sender: Address;
};

export type UpdatedRegistrationWithApplicationIdParams = {
    recipientId: Address;
    applicationId: bigint;
    data: Hex;
    sender: Address;
    status: string; //uint8
};

// ======================= DirectAllocated =======================
export type DirectAllocatedParams = {
    profileId: Bytes32String;
    profileOwner: Address;
    amount: string; //uint256
    token: Address;
    sender: Address;
};

/**
 * Type guard for Strategy events.
 * @param event The event to check.
 * @returns True if the event is a Strategy event, false otherwise.
 */
export function isStrategyEvent(
    event: ProcessorEvent<ContractName, AnyEvent>,
): event is ProcessorEvent<"Strategy", StrategyEvent> {
    return (
        event.contractName === "Strategy" &&
        (StrategyEventArray as readonly string[]).includes(event.eventName)
    );
}
