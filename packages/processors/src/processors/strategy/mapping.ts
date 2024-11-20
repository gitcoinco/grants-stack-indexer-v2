import { Hex } from "viem";

import type { StrategyHandlerConstructor } from "../../internal.js";
import { DirectAllocationStrategyHandler } from "./directAllocation/index.js";
import { DirectGrantsLiteStrategyHandler } from "./directGrantsLite/index.js";
import { DGSimpleStrategyHandler } from "./directGrantsSimple/index.js";
import { DVMDDirectTransferStrategyHandler } from "./donationVotingMerkleDistributionDirectTransfer/dvmdDirectTransfer.handler.js";

/**
 * This mapping connects strategy IDs to their corresponding handler classes.
 * When a new strategy event is received, the system uses this mapping to instantiate the appropriate handler
 * based on the strategy ID from the event. Each handler implements specific logic for processing events
 * from that strategy type.
 */
const strategyIdToHandler: Readonly<Record<string, StrategyHandlerConstructor>> = {
    "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf":
        DVMDDirectTransferStrategyHandler, // DonationVotingMerkleDistributionDirectTransferStrategyv1.0
    "0x2f46bf157821dc41daa51479e94783bb0c8699eac63bf75ec450508ab03867ce":
        DVMDDirectTransferStrategyHandler, // DonationVotingMerkleDistributionDirectTransferStrategyv1.1
    "0x2f0250d534b2d59b8b5cfa5eb0d0848a59ccbf5de2eaf72d2ba4bfe73dce7c6b":
        DVMDDirectTransferStrategyHandler, // DonationVotingMerkleDistributionDirectTransferStrategyv2.0
    "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0":
        DVMDDirectTransferStrategyHandler, // DonationVotingMerkleDistributionDirectTransferStrategyv2.1
    "0x4cd0051913234cdd7d165b208851240d334786d6e5afbb4d0eec203515a9c6f3":
        DirectAllocationStrategyHandler,
    "0x263cb916541b6fc1fb5543a244829ccdba75264b097726e6ecc3c3cfce824bf5": DGSimpleStrategyHandler,
    "0x53fb9d3bce0956ca2db5bb1441f5ca23050cb1973b33789e04a5978acfd9ca93": DGSimpleStrategyHandler,
    "0x103732a8e473467a510d4128ee11065262bdd978f0d9dad89ba68f2c56127e27":
        DirectGrantsLiteStrategyHandler,
} as const;

/**
 * Get a handler for a given strategy ID
 * @param strategyId - The strategy ID to get the handler for
 * @returns The handler for the strategy ID or undefined if it doesn't exist
 */
export const getHandler = (strategyId: Hex): StrategyHandlerConstructor | undefined => {
    return strategyIdToHandler[strategyId.toLowerCase()];
};

/**
 * Check if a handler exists for a given strategy ID
 * @param strategyId - The strategy ID to check
 * @returns True if a handler exists, false otherwise
 */
export const existsHandler = (strategyId: Hex): boolean => {
    return strategyIdToHandler[strategyId.toLowerCase()] !== undefined;
};
