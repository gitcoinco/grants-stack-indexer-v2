import { afterEach, describe, expect, it, vi } from "vitest";

import { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import { ProcessorDependencies } from "../../../src/internal.js";
import { ProfileMetadataUpdatedHandler } from "../../../src/processors/registry/handlers/profileMetadataUpdated.handler.js";

describe("ProfileMetadataUpdatedHandler", () => {
    const mockCid = "mockCid";
    const mockEvent: ProcessorEvent<"Registry", "ProfileMetadataUpdated"> = {
        params: {
            metadata: [0, mockCid],
            profileId: "mockProfileId",
        },
        // Add other necessary event properties here
    } as ProcessorEvent<"Registry", "ProfileMetadataUpdated">;

    const mockDependencies = {
        metadataProvider: {
            getMetadata: vi.fn(),
        },
        logger: {
            warn: vi.fn(),
        },
    } as unknown as ProcessorDependencies;

    const chainId = 1 as ChainId;

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("handles valid metadata", async () => {
        const mockMetadata = {
            type: "program",
            name: "Test Project",
        };
        vi.spyOn(mockDependencies.metadataProvider, "getMetadata").mockResolvedValueOnce(
            mockMetadata,
        );

        const handler = new ProfileMetadataUpdatedHandler(mockEvent, chainId, mockDependencies);
        const result = await handler.handle();

        expect(mockDependencies.metadataProvider.getMetadata).toHaveBeenCalledWith(mockCid);
        expect(result).toEqual([
            {
                type: "UpdateProject",
                args: {
                    chainId,
                    projectId: mockEvent.params.profileId,
                    project: {
                        metadataCid: mockCid,
                        metadata: mockMetadata,
                        projectType: "canonical",
                    },
                },
            },
        ]);
    });

    it("returns an empty array for invalid metadata", async () => {
        vi.spyOn(mockDependencies.metadataProvider, "getMetadata").mockResolvedValueOnce(null);

        const handler = new ProfileMetadataUpdatedHandler(mockEvent, chainId, mockDependencies);
        const result = await handler.handle();

        expect(result).toEqual([]);
    });

    it("throws an error if getMetadata fails", async () => {
        vi.spyOn(mockDependencies.metadataProvider, "getMetadata").mockRejectedValueOnce(
            new Error("Failed to fetch metadata"),
        );

        const handler = new ProfileMetadataUpdatedHandler(mockEvent, chainId, mockDependencies);

        await expect(handler.handle()).rejects.toThrow("Failed to fetch metadata");
    });
});
