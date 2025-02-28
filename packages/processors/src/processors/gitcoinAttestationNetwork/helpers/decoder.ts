import { decodeAbiParameters, Hex } from "viem";

import { GitcoinAttestedData } from "../types/index.js";

const GITCOIN_ATTESTED_DATA_ABI = [
    { name: "projectsContributed", type: "uint64" },
    { name: "roundsCountributed", type: "uint64" },
    { name: "chainIdsContributed", type: "uint64" },
    { name: "totalUSDAmount", type: "uint128" },
    { name: "timestamp", type: "uint64" },
    { name: "metadataCid", type: "string" },
] as const;

export const decodeAttestedData = (encodedData: Hex): GitcoinAttestedData => {
    const decodedData = decodeAbiParameters(GITCOIN_ATTESTED_DATA_ABI, encodedData);

    const results: GitcoinAttestedData = {
        projectsContributed: decodedData[0],
        roundsContributed: decodedData[1],
        chainIdsContributed: decodedData[2],
        totalUSDAmount: decodedData[3],
        timestamp: decodedData[4],
        metadataCid: decodedData[5],
    };

    return results;
};
