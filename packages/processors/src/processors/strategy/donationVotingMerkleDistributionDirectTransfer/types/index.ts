import { Address } from "@grants-stack-indexer/shared";

export type DVMDApplicationData = {
    recipientsCounter: string;
    anchorAddress: Address;
    recipientAddress: Address;
    metadata: {
        protocol: number;
        pointer: string;
    };
};
