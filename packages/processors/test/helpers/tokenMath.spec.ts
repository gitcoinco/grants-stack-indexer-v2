import { parseGwei } from "viem";
import { describe, expect, it, test } from "vitest";

import { calculateAmountInToken, calculateAmountInUsd } from "../../src/helpers/tokenMath.js";
import { InvalidArgument } from "../../src/internal.js";

describe("calculateAmountInUsd", () => {
    it("calculate USD amount for 18 decimal token with integer price", () => {
        const amount = 1000000000000000000n; // 1 token
        const tokenPriceInUsd = 100; // $100 per token
        const tokenDecimals = 18;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);
        expect(result).toBe("100");
    });

    it("calculate USD amount for 18 decimal token with float price", () => {
        const amount = 1500000000000000000n; // 1.5 tokens
        const tokenPriceInUsd = 27.35; // $27.35 per token
        const tokenDecimals = 18;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);
        expect(result).toBe("41.025");
    });

    it("calculate USD amount for 8 decimal token with integer price", () => {
        const amount = 100000000n; // 1 token
        const tokenPriceInUsd = 50; // $50 per token
        const tokenDecimals = 8;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);
        expect(result).toBe("50");
    });

    // Test case for 8 decimal token with float price
    it("correctly calculates USD amount for 8 decimal token with float price", () => {
        const amount = 150000000n; // 1.5 tokens
        const tokenPriceInUsd = 12.75; // $12.75 per token
        const tokenDecimals = 8;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);
        expect(result).toBe("19.125");
    });

    it("correctly calculate USD amount for 1gwei token amount", () => {
        const amount = parseGwei("1"); // 1 gwei in wei
        const tokenPriceInUsd = 1000; // $1000 per token
        const tokenDecimals = 18;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);
        expect(result).toBe("0.000001");
    });

    it("correctly truncate decimals when specified", () => {
        const amount = 1234567890123456789n; // 1.234567890123456789 tokens
        const tokenPriceInUsd = 1.23; // $1.23 per token
        const tokenDecimals = 18;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals, 4);
        expect(result).toBe("1.5185");
    });

    it("handle token price with 19 decimal digits", () => {
        const amount = 1000000000000000000n; // 1 token
        const tokenPriceInUsd = 1e-19; // 19 decimal places
        const tokenDecimals = 18;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);

        expect(result).toBe("0.0000000000000000001");
    });

    it("handle scientific notation token price with interspersed non-zero digits in result", () => {
        const amount = 123456789012345678n; // 0.123456789012345678 tokens
        const tokenPriceInUsd = 1.23e-15; // 0.00000000000000123
        const tokenDecimals = 18;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);

        expect(result).toBe("0.00000000000000015185");
    });

    it("return zero for zero token amount", () => {
        const amount = 0n;
        const tokenPriceInUsd = 100;
        const tokenDecimals = 18;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);
        expect(result).toBe("0");
    });

    it("returns zero for zero token price", () => {
        const amount = 1000000000000000000n; // 1 token
        const tokenPriceInUsd = 0;
        const tokenDecimals = 18;

        const result = calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals);
        expect(result).toBe("0");
    });

    it("throw an error for invalid truncate decimals", () => {
        const amount = 1000000000000000000n; // 1 token
        const tokenPriceInUsd = 100;
        const tokenDecimals = 18;

        expect(() => calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals, -1)).toThrow(
            InvalidArgument,
        );
        expect(() => calculateAmountInUsd(amount, tokenPriceInUsd, tokenDecimals, 19)).toThrow(
            InvalidArgument,
        );
    });

    test("migrated cases", () => {
        expect(calculateAmountInUsd(3400000000000000000n, 1, 18, 8)).toBe("3.4");

        expect(calculateAmountInUsd(50000000000n, 1, 18, 8)).toBe("0.00000005");

        expect(calculateAmountInUsd(3400000000000000000n, 0.5, 18, 8)).toBe("1.7");

        expect(calculateAmountInUsd(3400000000000000000n, 2, 18, 8)).toBe("6.8");
    });
});

describe("calculateAmountInToken", () => {
    it("correctly calculate the amount in token", () => {
        expect(calculateAmountInToken("1", "1", 18)).toBe(1000000000000000000n);
        expect(calculateAmountInToken("1", "1", 8)).toBe(100000000n);
    });

    test("migrated cases", () => {
        expect(calculateAmountInToken("3.4", "1", 18)).toBe(3400000000000000000n);

        expect(calculateAmountInToken("3.4", "2", 18)).toBe(1700000000000000000n);

        expect(calculateAmountInToken("3.4", "0.5", 18)).toBe(6800000000000000000n);
    });

    it("return zero for zero USD amount", () => {
        expect(calculateAmountInToken("0", "1", 18)).toBe(0n);
    });

    it("handle very large USD amounts", () => {
        expect(calculateAmountInToken("1000000000000000000", "1", 18)).toBe(
            1000000000000000000000000000000000000n,
        );
    });

    it("handle small USD amounts", () => {
        expect(calculateAmountInToken("0.01", "0.001", 18)).toBe(10000000000000000000n);
    });

    it("handle very large token price", () => {
        expect(calculateAmountInToken("2", "1000000000000000000", 18)).toBe(2n);
    });

    it("throw an error for zero token price", () => {
        expect(() => calculateAmountInToken("1", "0", 18)).toThrow();
    });

    it("handle scientific notation for USD amount", () => {
        expect(calculateAmountInToken("1e3", "1", 18)).toBe(1000000000000000000000n);
    });

    it("truncates decimals to floor", () => {
        // For 6 decimal token
        expect(calculateAmountInToken("1.123456", "1", 6)).toBe(1123456n);
        expect(calculateAmountInToken("1", "0.123456", 6)).toBe(8100051n); // 8100051.840331778 before truncation

        // For 8 decimal token
        expect(calculateAmountInToken("1.12345678", "1", 8)).toBe(112345678n);
        expect(calculateAmountInToken("1", "0.12345678", 8)).toBe(810000066n); // 810000066.4200054 before truncation
    });
});
