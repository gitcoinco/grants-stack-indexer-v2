import { getAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import { PartialRound } from "@grants-stack-indexer/repository";
import { Bytes32String, ChainId, Logger, ProcessorEvent } from "@grants-stack-indexer/shared";

import {
    BaseDistributionUpdatedHandler,
    MetadataNotFound,
    MetadataParsingFailed,
} from "../../../src/internal.js";
import { createMockEvent } from "../../mocks/index.js";

describe("BaseDistributionUpdatedHandler", () => {
    let handler: BaseDistributionUpdatedHandler;
    let mockMetadataProvider: IMetadataProvider;
    let mockLogger: Logger;
    let mockEvent: ProcessorEvent<"Strategy", "DistributionUpdated">;
    const chainId = 10 as ChainId;
    const eventName = "DistributionUpdated";
    const defaultParams = {
        metadata: ["1", "ipfs://QmTestHash"] as [string, string],
        merkleRoot: "0xroot" as Bytes32String,
    };
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

    beforeEach(() => {
        mockMetadataProvider = {
            getMetadata: vi.fn(),
        } as unknown as IMetadataProvider;
        mockLogger = {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
        } as unknown as Logger;
    });

    it("handles a valid distribution update event", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockDistribution = {
            matchingDistribution: [
                {
                    applicationId: "app1",
                    projectPayoutAddress: "projectPayoutAddress",
                    projectId: "projectId",
                    projectName: "projectName",
                    matchPoolPercentage: 100,
                    contributionsCount: 100,
                    originalMatchAmountInToken: "9",
                    matchAmountInToken: "10",
                },
            ],
        };

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(mockDistribution);

        handler = new BaseDistributionUpdatedHandler(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "UpdateRoundByStrategyAddress",
                args: {
                    chainId,
                    strategyAddress: getAddress(mockEvent.srcAddress),
                    round: {
                        readyForPayoutTransaction: mockEvent.transactionFields.hash,
                        matchingDistribution: mockDistribution.matchingDistribution,
                    },
                },
            },
        ]);
    });

    it("throws MetadataNotFound if distribution metadata is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(undefined);

        handler = new BaseDistributionUpdatedHandler(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(MetadataNotFound);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("No matching distribution found for pointer:"),
        );
    });

    it("throw MatchingDistributionParsingError if distribution format is invalid", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const invalidDistribution = {
            matchingDistribution: [
                {
                    amount: "not_a_number", // Invalid amount format
                    applicationId: "app1",
                    recipientAddress: "0x1234567890123456789012345678901234567890",
                },
            ],
        };

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(invalidDistribution);

        handler = new BaseDistributionUpdatedHandler(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(MetadataParsingFailed);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Failed to parse matching distribution:"),
        );
    });

    it("handles empty matching distribution array", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const emptyDistribution = {
            matchingDistribution: [],
        };

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(emptyDistribution);

        handler = new BaseDistributionUpdatedHandler(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        const result = await handler.handle();
        expect(result).toHaveLength(1);

        const changeset = result[0] as {
            type: "UpdateRoundByStrategyAddress";
            args: {
                round: PartialRound;
            };
        };
        expect(changeset.args.round.matchingDistribution).toEqual([]);
    });
});
