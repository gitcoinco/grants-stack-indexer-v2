import { describe, expect, expectTypeOf, it } from "vitest";

import { existsHandler } from "../../src/external.js";
import { getHandler, StrategyHandlerConstructor } from "../../src/internal.js";
import { DVMDDirectTransferStrategyHandler } from "../../src/processors/strategy/donationVotingMerkleDistributionDirectTransfer/dvmdDirectTransfer.handler.js";

describe("Strategy Mapping", () => {
    describe("getHandler", () => {
        it("returns the correct handler for a valid strategy ID", () => {
            const validStrategyId =
                "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf";

            const handler = getHandler(validStrategyId);

            expect(handler).toBeDefined();
            expect(handler).toBe(DVMDDirectTransferStrategyHandler);
            expectTypeOf(handler).toEqualTypeOf<StrategyHandlerConstructor | undefined>();
        });

        it("returns the correct handler for a valid strategy ID in uppercase", () => {
            const validStrategyId =
                "0x6F9291DF02B2664139CEC5703C124E4EBCE32879C74B6297FAA1468AA5FF9EBF";

            const handler = getHandler(validStrategyId);

            expect(handler).toBeDefined();
            expect(handler).toBe(DVMDDirectTransferStrategyHandler);
            expectTypeOf(handler).toEqualTypeOf<StrategyHandlerConstructor | undefined>();
        });

        it("returns undefined for an invalid strategy ID", () => {
            const invalidStrategyId =
                "0x1234567890123456789012345678901234567890123456789012345678901234";

            const handler = getHandler(invalidStrategyId);

            expect(handler).toBeUndefined();
        });
    });

    describe("existsHandler", () => {
        it("returns true for a valid strategy ID", () => {
            const validStrategyId =
                "0x2f46bf157821dc41daa51479e94783bb0c8699eac63bf75ec450508ab03867ce";

            const exists = existsHandler(validStrategyId);

            expect(exists).toBe(true);
        });

        it("returns true for a valid strategy ID in uppercase", () => {
            const validStrategyId =
                "0x2F46BF157821DC41DAA51479E94783BB0C8699EAC63BF75EC450508AB03867CE";

            const exists = existsHandler(validStrategyId);

            expect(exists).toBe(true);
        });

        it("returns false for an invalid strategy ID", () => {
            const invalidStrategyId =
                "0x1234567890123456789012345678901234567890123456789012345678901234";

            const exists = existsHandler(invalidStrategyId);

            expect(exists).toBe(false);
        });
    });
});
