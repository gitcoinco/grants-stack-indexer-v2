import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ICache } from "@grants-stack-indexer/repository";
import { ILogger } from "@grants-stack-indexer/shared";

import { IMetadataProvider } from "../../src/internal.js";
import { CachingMetadataProvider } from "../../src/providers/cachingProxy.provider.js";

describe("CachingMetadataProvider", () => {
    const mockProvider = {
        getMetadata: vi.fn(),
    } as unknown as IMetadataProvider;

    const mockCache = {
        get: vi.fn(),
        set: vi.fn(),
    } as unknown as ICache<string, unknown>;

    const mockLogger = {
        debug: vi.fn(),
        verbose: vi.fn(),
    } as unknown as ILogger;

    let provider: CachingMetadataProvider;

    beforeEach(() => {
        provider = new CachingMetadataProvider(mockProvider, mockCache, mockLogger, {
            maxTry: 1,
            delay: 1,
        });
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("getMetadata", () => {
        const testCid = "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku";
        const testData = { foo: "bar" };
        const testSchema = z.object({ foo: z.string() });

        it("returns cached metadata when available", async () => {
            vi.spyOn(mockCache, "get").mockResolvedValue(testData);

            const result = await provider.getMetadata(testCid, testSchema);

            expect(result).toEqual(testData);
            expect(mockCache.get).toHaveBeenCalledWith(testCid);
            expect(mockProvider.getMetadata).not.toHaveBeenCalled();
        });

        it("fetches and caches metadata when cache misses", async () => {
            vi.spyOn(mockCache, "get").mockResolvedValue(undefined);
            vi.spyOn(mockProvider, "getMetadata").mockResolvedValue(testData);

            const result = await provider.getMetadata(testCid, testSchema);

            expect(result).toEqual(testData);
            expect(mockCache.get).toHaveBeenCalledWith(testCid);
            expect(mockProvider.getMetadata).toHaveBeenCalledWith(testCid, testSchema);
            expect(mockCache.set).toHaveBeenCalledWith(testCid, testData);
        });

        it("handles cache read failures gracefully", async () => {
            vi.spyOn(mockCache, "get").mockRejectedValue(new Error("Cache read error"));
            vi.spyOn(mockProvider, "getMetadata").mockResolvedValue(testData);

            const result = await provider.getMetadata(testCid, testSchema);
            expect(result).toEqual(testData);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Failed to get cached metadata for IPFS CID ${testCid}`,
                expect.any(Object),
            );
            expect(mockProvider.getMetadata).toHaveBeenCalledWith(testCid, testSchema);
        });

        it("handles cache write failures gracefully", async () => {
            vi.spyOn(mockCache, "get").mockResolvedValue(undefined);
            vi.spyOn(mockCache, "set").mockRejectedValue(new Error("Cache write error"));
            vi.spyOn(mockProvider, "getMetadata").mockResolvedValue(testData);

            const result = await provider.getMetadata(testCid, testSchema);

            expect(result).toEqual(testData);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Failed to cache metadata for IPFS CID ${testCid}`,
                expect.any(Object),
            );
        });

        it("returns undefined when metadata is not found", async () => {
            vi.spyOn(mockCache, "get").mockResolvedValue(undefined);
            vi.spyOn(mockProvider, "getMetadata").mockResolvedValue(undefined);

            const result = await provider.getMetadata(testCid, testSchema);

            expect(result).toBeNull();
            expect(mockCache.set).toHaveBeenCalled();
        });

        it("returns null when cid is empty", async () => {
            const result = await provider.getMetadata("", testSchema);

            expect(result).toBeNull();
        });

        it("returns null when cid is not valid", async () => {
            const result = await provider.getMetadata("invalid", testSchema);

            expect(result).toBeNull();
        });
    });
});
