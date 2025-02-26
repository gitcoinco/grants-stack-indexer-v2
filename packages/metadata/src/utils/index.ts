import { CID } from "multiformats/cid";

export const isValidCid = (input: string): boolean => {
    try {
        // Extract CID part from optional paths/params
        const match = input.match(/^([^/?#]+)(?:[/?#].*)?$/);
        if (!match) return false;

        const cid = match[1];

        if (!cid) return false;

        // Quick regex check for basic format
        const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[0-9A-Za-z]+)$/;
        if (!cidRegex.test(cid)) return false;

        // Full validation using multiformats/cid
        CID.parse(cid);
        return true;
    } catch {
        return false;
    }
};
