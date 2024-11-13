import { Address } from "@grants-stack-indexer/shared";

export type DVMDApplicationData = {
    anchorAddress: Address;
    recipientAddress: Address;
    metadata: {
        protocol: number;
        pointer: string;
    };
};

export type DVMDExtendedApplicationData = DVMDApplicationData & {
    recipientsCounter: string;
};
