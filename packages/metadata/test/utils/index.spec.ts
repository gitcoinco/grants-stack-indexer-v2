import { describe, expect, it } from "vitest";

import { isValidCid } from "../../src/utils/index.js";

describe("isValidCid", () => {
    it("return true for valid CIDs", () => {
        const validCids = [
            "QmW2WQi7j6c7UgJTarActp7tDNikE4B2qXtFCfLPdsgaTQ",
            "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        ];

        validCids.forEach((cid) => {
            expect(isValidCid(cid)).toBe(true);
        });
    });

    it("return false for invalid CIDs", () => {
        const invalidCids = [
            "",
            "QmInvalidCID",
            "bafInvalidCID",
            "Qm1234567890123456789012345678901234567890123",
            "baf123456789012345678901234567890123456789012345678901",
            "not a CID at all",
        ];

        invalidCids.forEach((cid) => {
            expect(isValidCid(cid)).toBe(false);
        });
    });

    it("return false for non-string inputs", () => {
        const nonStringInputs = [null, undefined, 123, {}, []];

        nonStringInputs.forEach((input) => {
            expect(isValidCid(input as unknown as string)).toBe(false);
        });
    });

    it("returns true when CID has path or query parameters", () => {
        const cidWithParams = "QmW2WQi7j6c7UgJTarActp7tDNikE4B2qXtFCfLPdsgaTQ/path?param=value";
        expect(isValidCid(cidWithParams)).toBe(true);
    });
});
