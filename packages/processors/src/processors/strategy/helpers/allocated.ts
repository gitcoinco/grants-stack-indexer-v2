import { encodePacked, keccak256 } from "viem/utils";

/**
 * DONATION_ID = keccak256(abi.encodePacked(blockNumber, "-", logIndex));
 */
export const getDonationId = (blockNumber: number, logIndex: number): string => {
    return keccak256(encodePacked(["string"], [`${blockNumber}-${logIndex}`]));
};
