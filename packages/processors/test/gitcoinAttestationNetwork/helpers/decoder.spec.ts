import { describe, expect, it } from "vitest";

import { decodeAttestedData } from "../../../src/processors/gitcoinAttestationNetwork/helpers/decoder.js";
import { GitcoinAttestedData } from "../../../src/processors/gitcoinAttestationNetwork/types/index.js";

describe("decodeAttestedData", () => {
    it("correctly decodes attestation data", () => {
        const expectedData: GitcoinAttestedData = {
            projectsContributed: 1n,
            roundsCountributed: 1n,
            chainIdsContributed: 1n,
            totalUSDAmount: 10n,
            timestamp: 1727704881770n,
            metadataCid: "bafkreienxv67ib64imn6qgjjgyyltwy73wgqa2xutziryntfcu5vpoz74a",
        };
        const encodedData =
            "0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000192433c5a6a00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000003b6261666b726569656e7876363769623634696d6e3671676a6a6779796c747779373377677161327875747a6972796e746663753576706f7a3734610000000000";
        const decodedData = decodeAttestedData(encodedData);

        expect(decodedData).toEqual(expectedData);
    });

    it("throws an error if the data is not a valid attested data", () => {
        const invalidData =
            "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001";

        expect(() => decodeAttestedData(invalidData)).toThrow();
    });
});
