import { decodeAbiParameters, Hex } from "viem";

import {
    DVMDApplicationData,
    DVMDExtendedApplicationData,
} from "../donationVotingMerkleDistributionDirectTransfer/types/index.js";

const DVMD_EVENT_DATA_DECODER = [
    { name: "data", type: "bytes" },
    { name: "recipientsCounter", type: "uint256" },
] as const;

const DVMD_DATA_DECODER = [
    { name: "registryAnchor", type: "address" },
    { name: "recipientAddress", type: "address" },
    {
        name: "metadata",
        type: "tuple",
        components: [
            { name: "protocol", type: "uint256" },
            { name: "pointer", type: "string" },
        ],
    },
] as const;

export const decodeDVMDApplicationData = (encodedData: Hex): DVMDApplicationData => {
    const decodedData = decodeAbiParameters(DVMD_DATA_DECODER, encodedData);

    const results: DVMDApplicationData = {
        anchorAddress: decodedData[0],
        recipientAddress: decodedData[1],
        metadata: {
            protocol: Number(decodedData[2].protocol),
            pointer: decodedData[2].pointer,
        },
    };

    return results;
};

export const decodeDVMDExtendedApplicationData = (
    encodedData: Hex,
): DVMDExtendedApplicationData => {
    const values = decodeAbiParameters(DVMD_EVENT_DATA_DECODER, encodedData);

    const encodededDVMD = decodeDVMDApplicationData(values[0]);

    return {
        ...encodededDVMD,
        recipientsCounter: values[1].toString(),
    };
};
