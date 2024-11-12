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
    amount: bigint;
};

export type DistributedWithDataParams = {
    data: Hex;
    sender: Address;
};

export type DistributedWithFlowRateParams = {
    flowRate: bigint;
    sender: Address;
};

// ======================= TimestampsUpdated =======================

export type TimestampsUpdatedParams = {
    startTime: bigint;
    endTime: bigint;
    sender: Address;
};

export type TimestampsUpdatedWithRegistrationAndAllocationParams = {
    registrationStartTime: bigint;
    registrationEndTime: bigint;
    allocationStartTime: bigint;
    allocationEndTime: bigint;
    sender: Address;
};

// ======================= FundsDistributed =======================
export type FundsDistributedParams = {
    amount: bigint;
    grantee: Address;
    token: Address;
    recipientId: Address;
};

// ======================= Allocated =======================
export type AllocatedWithTokenParams = {
    recipientId: Address;
    amount: bigint;
    token: Address;
    sender: Address;
};

export type AllocatedWithOriginParams = {
    recipientId: Address;
    amount: bigint;
    token: Address;
    sender: Address;
    origin: Address;
};

export type AllocatedWithVotesParams = {
    recipientId: Address;
    votes: bigint;
    allocator: Address;
};

export type AllocatedWithStatusParams = {
    recipientId: Address;
    status: number;
    sender: Address;
};

// ======================= DistributionUpdated =======================
export type DistributionUpdatedParams = {
    merkleRoot: Bytes32String;
    metadata: [protocol: bigint, pointer: string];
};

// ======================= RecipientStatusUpdated =======================
export type RecipientStatusUpdatedWithApplicationIdParams = {
    recipientId: Address;
    applicationId: bigint;
    status: number;
    sender: Address;
};

export type RecipientStatusUpdatedWithRecipientStatusParams = {
    recipientId: Address;
    status: number;
    sender: Address;
};

export type RecipientStatusUpdatedWithFullRowParams = {
    rowIndex: bigint;
    fullRow: bigint;
    sender: Address;
};

// ======================= UpdatedRegistration =======================
export type UpdatedRegistrationWithStatusParams = {
    recipientId: Address;
    data: Hex;
    sender: Address;
    status: number;
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
    status: number;
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
