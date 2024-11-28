import { Address, AnyEvent, ContractName, ProcessorEvent } from "../../internal.js";
import { RoleGrantedParams, RoleRevokedParams } from "./index.js";

/**
 * This array is used to represent all Allo events.
 */
const AlloEventArray = [
    "PoolCreated",
    "PoolFunded",
    "PoolMetadataUpdated",
    "RoleGranted",
    "RoleRevoked",
] as const;

/**
 * This type is used to represent a Allo events.
 */
export type AlloEvent = (typeof AlloEventArray)[number];

/**
 * This type maps Allo events to their respective parameters.
 */
export type AlloEventParams<T extends AlloEvent> = T extends "PoolCreated"
    ? PoolCreatedParams
    : T extends "PoolMetadataUpdated"
      ? PoolMetadataUpdatedParams
      : T extends "PoolFunded"
        ? PoolFundedParams
        : T extends "RoleGranted"
          ? RoleGrantedParams
          : T extends "RoleRevoked"
            ? RoleRevokedParams
            : never;

// =============================================================================
// =============================== Event Parameters ============================
// =============================================================================
export type PoolCreatedParams = {
    strategy: Address;
    poolId: string; //uint256
    profileId: Address;
    token: Address;
    amount: string; //uint256
    metadata: [protocol: string /*uint256*/, pointer: string];
};

export type PoolMetadataUpdatedParams = {
    poolId: string; //uint256
    metadata: [protocol: string /*uint256*/, pointer: string];
};

export type PoolFundedParams = {
    poolId: string; //uint256
    amount: string; //uint256
    fee: string; //uint256
};

/**
 * Type guard for Allo events.
 * @param event The event to check.
 * @returns True if the event is a Allo event, false otherwise.
 */
export function isAlloEvent(
    event: ProcessorEvent<ContractName, AnyEvent>,
): event is ProcessorEvent<"Allo", AlloEvent> {
    return (
        event.contractName === "Allo" &&
        (AlloEventArray as readonly string[]).includes(event.eventName)
    );
}
