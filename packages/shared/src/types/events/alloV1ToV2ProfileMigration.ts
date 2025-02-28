import { AnyEvent, Bytes32String, ContractName, ProcessorEvent } from "../../internal.js";

/**
 * This array is used to represent all AlloV1ToV2ProfileMigration events.
 */
const AlloV1ToV2ProfileMigrationEventArray = ["ProfileMigrated"] as const;

/**
 * This type is used to represent a AlloV1ToV2ProfileMigration events.
 */
export type AlloV1ToV2ProfileMigrationEvent = (typeof AlloV1ToV2ProfileMigrationEventArray)[number];

/**
 * This type maps AlloV1ToV2ProfileMigration events to their respective parameters.
 */
export type AlloV1ToV2ProfileMigrationEventParams<T extends AlloV1ToV2ProfileMigrationEvent> =
    T extends "ProfileMigrated" ? ProfileMigratedParams : never;

// =============================================================================
// =============================== Event Parameters ============================
// =============================================================================
export type ProfileMigratedParams = {
    //bytes32 indexed alloV1, uint256 alloV1ChainId, bytes32 indexed alloV2, uint256 nonce
    alloV1: Bytes32String;
    alloV1ChainId: string; //uint256
    alloV2: Bytes32String;
    nonce: string; //uint256
};

/**
 * Type guard for AlloV1ToV2ProfileMigration events.
 * @param event The event to check.
 * @returns True if the event is a AlloV1ToV2ProfileMigration event, false otherwise.
 */
export function isAlloV1ToV2ProfileMigrationEvent(
    event: ProcessorEvent<ContractName, AnyEvent>,
): event is ProcessorEvent<"AlloV1ToV2ProfileMigration", AlloV1ToV2ProfileMigrationEvent> {
    return (
        event.contractName === "AlloV1ToV2ProfileMigration" &&
        (AlloV1ToV2ProfileMigrationEventArray as readonly string[]).includes(event.eventName)
    );
}
