import { Address, Hex } from "viem";

import { Bytes32String } from "../common.js";
import { AnyEvent, ContractName, ProcessorEvent } from "./common.js";

const GitcoinAttestationNetworkEventArray = ["OnAttested"] as const;

export type GitcoinAttestationNetworkEvent = (typeof GitcoinAttestationNetworkEventArray)[number];

export type GitcoinAttestationNetworkEventParams<T extends GitcoinAttestationNetworkEvent> =
    T extends "OnAttested" ? OnAttestedParams : never;

// ======================= OnAttested =======================
export type OnAttestedParams = {
    uid: Bytes32String;
    recipient: Address;
    fee: string; //uint256
    data: Hex;
    refUID: Bytes32String;
};

/**
 * Type guard for GitcoinAttestationNetwork events.
 * @param event The event to check.
 * @returns True if the event is a GitcoinAttestationNetwork event, false otherwise.
 */
export function isGitcoinAttestationNetworkEvent(
    event: ProcessorEvent<ContractName, AnyEvent>,
): event is ProcessorEvent<"GitcoinAttestationNetwork", GitcoinAttestationNetworkEvent> {
    return (
        event.contractName === "GitcoinAttestationNetwork" &&
        (GitcoinAttestationNetworkEventArray as readonly string[]).includes(event.eventName)
    );
}
