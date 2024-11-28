import { Address, Bytes32String } from "../../internal.js";

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
