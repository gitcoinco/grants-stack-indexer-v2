// TODO: Should we validate event params in runtime ? How should we approach that ?

import { Address, AnyEvent, Bytes32String, ContractName, ProcessorEvent } from "../../internal.js";

/**
 * This array is used to represent all Registry events.
 */
const RegistryEventArray = [
    "ProfileCreated",
    "ProfileMetadataUpdated",
    "ProfileNameUpdated",
    "ProfileOwnerUpdated",
    "RoleGranted",
    "RoleRevoked",
] as const;

/**
 * This type is used to represent a Registry events.
 */
export type RegistryEvent = (typeof RegistryEventArray)[number];

/**
 * This type maps Registry events to their respective parameters.
 */
export type RegistryEventParams<T extends RegistryEvent> = T extends "ProfileCreated"
    ? ProfileCreatedParams
    : T extends "RoleGranted"
      ? RoleGrantedParams
      : T extends "ProfileMetadataUpdated"
        ? ProfileMetadataUpdatedParams
        : T extends "ProfileNameUpdated"
          ? ProfileNameUpdatedParams
          : T extends "ProfileOwnerUpdated"
            ? ProfileOwnerUpdatedParams
            : T extends "RoleRevoked"
              ? RoleRevokedParams
              : never;

// =============================================================================
// =============================== Event Parameters ============================
// =============================================================================
export type ProfileCreatedParams = {
    profileId: Bytes32String;
    nonce: bigint;
    name: string;
    metadata: [protocol: bigint, pointer: string];
    owner: Address;
    anchor: Address;
};
export type ProfileMetadataUpdatedParams = {
    profileId: Bytes32String;
    metadata: [protocol: bigint, pointer: string];
};
export type ProfileNameUpdatedParams = {
    profileId: Bytes32String;
    name: string;
    anchor: Address;
};
export type ProfileOwnerUpdatedParams = {
    profileId: Bytes32String;
    owner: Address;
};

export type RoleGrantedParams = {
    role: Bytes32String;
    account: Address;
    sender: Address;
};

export type RoleRevokedParams = {
    role: Bytes32String;
    account: Address;
    sender: Address;
};

/**
 * Type guard for Registry events.
 * @param event The event to check.
 * @returns True if the event is a Registry event, false otherwise.
 */
export function isRegistryEvent(
    event: ProcessorEvent<ContractName, AnyEvent>,
): event is ProcessorEvent<"Registry", RegistryEvent> {
    return (
        event.contractName === "Registry" &&
        (RegistryEventArray as readonly string[]).includes(event.eventName)
    );
}
