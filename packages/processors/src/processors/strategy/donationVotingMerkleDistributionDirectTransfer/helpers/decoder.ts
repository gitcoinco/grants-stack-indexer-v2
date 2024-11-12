import { decodeAbiParameters, Hex } from "viem";

import { Address } from "@grants-stack-indexer/shared";

import { DVMDApplicationData } from "../types/index.js";

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
    const values = decodeAbiParameters(DVMD_EVENT_DATA_DECODER, encodedData);

    const decodedData = decodeAbiParameters(DVMD_DATA_DECODER, values[0]);

    const results: DVMDApplicationData = {
        recipientsCounter: values[1].toString(),
        anchorAddress: decodedData[0] as Address,
        recipientAddress: decodedData[1] as Address,
        metadata: {
            protocol: Number(decodedData[2].protocol),
            pointer: decodedData[2].pointer,
        },
    };

    return results;
};
