import { describe, expect, it } from "vitest";

import { Changeset } from "@grants-stack-indexer/repository";
import { Address, Token, TokenCode } from "@grants-stack-indexer/shared";

import { BaseStrategyHandler } from "../../../src/processors/strategy/common/base.strategy.js";

// Create a concrete implementation of BaseStrategyHandler for testing
class TestStrategyHandler extends BaseStrategyHandler {
    constructor() {
        super("TestStrategy");
    }

    async handle(): Promise<Changeset[]> {
        return [];
    }
}

describe("BaseStrategyHandler", () => {
    const handler = new TestStrategyHandler();

    it("has the correct name", () => {
        expect(handler.name).toBe("TestStrategy");
    });

    describe("fetchStrategyTimings", () => {
        it("returns default timings", async () => {
            const address: Address = "0x1234567890123456789012345678901234567890";
            const timings = await handler.fetchStrategyTimings(address);

            expect(timings).toEqual({
                applicationsStartTime: null,
                applicationsEndTime: null,
                donationsStartTime: null,
                donationsEndTime: null,
            });
        });
    });

    describe("fetchMatchAmount", () => {
        it("returns default match amount", async () => {
            const matchingFundsAvailable = 1000;
            const token: Token = {
                address: "0x1234567890123456789012345678901234567890",
                decimals: 18,
                code: "ETH" as TokenCode,
                priceSourceCode: "ETH" as TokenCode,
            };
            const blockTimestamp = 1625097600; // Example timestamp

            const result = await handler.fetchMatchAmount(
                matchingFundsAvailable,
                token,
                blockTimestamp,
            );

            expect(result).toEqual({
                matchAmount: 0n,
                matchAmountInUsd: "0",
            });
        });
    });
});
