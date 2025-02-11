import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ILogger } from "@grants-stack-indexer/shared";

import {
    EmptyGatewaysUrlsException,
    InvalidContentException,
    PublicGatewayProvider,
} from "../../src/external.js";

describe("PublicGatewayProvider", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    let mock: MockAdapter;
    let provider: PublicGatewayProvider;
    const gateways = ["https://ipfs.io", "https://cloudflare-ipfs.com"];
    const validCid = "QmW2WQi7j6c7UgJTarActp7tDNikE4B2qXtFCfLPdsgaTQ";

    beforeEach(() => {
        provider = new PublicGatewayProvider(gateways, logger);
        mock = new MockAdapter(provider["axiosInstance"]);
    });

    afterEach(() => {
        mock.reset();
    });

    describe("constructor", () => {
        it("throw EmptyGatewaysUrlsException when initialized with empty gateways array", () => {
            expect(() => new PublicGatewayProvider([], logger)).toThrow(EmptyGatewaysUrlsException);
        });
    });

    describe("getMetadata", () => {
        it("return undefined for invalid CID", async () => {
            const result = await provider.getMetadata("invalid-cid");
            expect(result).toBeUndefined();
        });

        it("return undefined for empty CID", async () => {
            const result = await provider.getMetadata("");
            expect(result).toBeUndefined();
        });

        it("fetch metadata successfully from the first working gateway", async () => {
            const mockData = { name: "Test Data" };
            mock.onGet(`${gateways[0]}/ipfs/${validCid}`).reply(200, mockData);

            const result = await provider.getMetadata(validCid);
            expect(result).toEqual(mockData);
        });

        it("try the next gateway if the first one fails", async () => {
            const mockData = { name: "Test Data" };
            mock.onGet(`${gateways[0]}/ipfs/${validCid}`).networkError();
            mock.onGet(`${gateways[1]}/ipfs/${validCid}`).reply(200, mockData);

            const result = await provider.getMetadata(validCid);
            expect(result).toEqual(mockData);
        });

        it("throws if all gateways fail", async () => {
            gateways.forEach((gateway) => {
                mock.onGet(`${gateway}/ipfs/${validCid}`).networkError();
            });

            await expect(() => provider.getMetadata(validCid)).rejects.toThrow(Error);
        });

        it("validate content with provided schema", async () => {
            const mockData = { name: "Test Data", age: 30 };
            mock.onGet(`${gateways[0]}/ipfs/${validCid}`).reply(200, mockData);
            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });
            const result = await provider.getMetadata(validCid, schema);
            expect(result).toEqual(mockData);
        });

        it("throw InvalidContentException when content does not match schema", async () => {
            const mockData = { name: "Test Data", age: "thirty" };
            mock.onGet(`${gateways[0]}/ipfs/${validCid}`).reply(200, mockData);

            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            await expect(() => provider.getMetadata(validCid, schema)).rejects.toThrow(
                InvalidContentException,
            );
        });
    });
});
