import { describe, expect, it } from "vitest";

import {
    DVMDApplicationData,
    DVMDExtendedApplicationData,
} from "../../../../src/processors/strategy/donationVotingMerkleDistributionDirectTransfer/types/index.js";
import {
    decodeDVMDApplicationData,
    decodeDVMDExtendedApplicationData,
} from "../../../../src/processors/strategy/helpers/index.js";

describe("decodeDVMDApplicationData", () => {
    it("correctly decodes the encoded data", () => {
        const encodedData =
            "0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001000000000000000000000000002c7296a5ec0539f0a018c7176c97c92a9c44e2b4000000000000000000000000e7eb5d2b5b188777df902e89c54570e7ef4f59ce000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000";

        const expectedResult: DVMDExtendedApplicationData = {
            recipientsCounter: "1",
            anchorAddress: "0x2c7296a5eC0539f0A018C7176c97c92A9C44E2B4",
            recipientAddress: "0xE7eB5D2b5b188777df902e89c54570E7Ef4F59CE",
            metadata: {
                protocol: 1,
                pointer: "bafkreigyc43cfinxlnahq5aawsghibetv6usrs7kkxf7vxmzbjyro76iwy",
            },
        };

        const result = decodeDVMDExtendedApplicationData(encodedData);

        expect(result).toEqual(expectedResult);
    });

    it("throw an error for invalid encoded data", () => {
        const invalidEncodedData = "0x1234";

        expect(() => decodeDVMDExtendedApplicationData(invalidEncodedData)).toThrow();
    });
});

describe("decodeDVMDApplicationData", () => {
    it("correctly decodes the encoded data", () => {
        const encodedData =
            "0x0000000000000000000000002c7296a5ec0539f0a018c7176c97c92a9c44e2b4000000000000000000000000e7eb5d2b5b188777df902e89c54570e7ef4f59ce000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000";

        const expectedResult: DVMDApplicationData = {
            anchorAddress: "0x2c7296a5eC0539f0A018C7176c97c92A9C44E2B4",
            recipientAddress: "0xE7eB5D2b5b188777df902e89c54570E7Ef4F59CE",
            metadata: {
                protocol: 1,
                pointer: "bafkreigyc43cfinxlnahq5aawsghibetv6usrs7kkxf7vxmzbjyro76iwy",
            },
        };

        const result = decodeDVMDApplicationData(encodedData);

        expect(result).toEqual(expectedResult);
    });

    it("throw an error for invalid encoded data", () => {
        const invalidEncodedData = "0x1234";

        expect(() => decodeDVMDExtendedApplicationData(invalidEncodedData)).toThrow();
    });
});
