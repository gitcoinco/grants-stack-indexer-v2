import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EvmProvider } from "@grants-stack-indexer/chain-providers";
import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type { IPricingProvider } from "@grants-stack-indexer/pricing";
import type {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import type { ChainId, ILogger, ProcessorEvent } from "@grants-stack-indexer/shared";

import { UnsupportedEventException } from "../../../src/internal.js";
import {
    AlloV1ToV2ProfileMigrationProcessor,
    ProfileMigratedHandler,
} from "../../../src/processors/alloV1ToV2ProfileMigration/index.js";

// Mock the handlers
vi.mock("../../../src/processors/alloV1ToV2ProfileMigration/handlers/ProfileMigrated.ts", () => {
    const ProfileMigratedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ProfileMigratedHandler.prototype.handle = vi.fn();
    return {
        ProfileMigratedHandler,
    };
});

describe("AlloV1ToV2ProfileMigrationProcessor", () => {
    const mockChainId = 10 as ChainId;
    let processor: AlloV1ToV2ProfileMigrationProcessor;
    let mockEvmProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    beforeEach(() => {
        mockEvmProvider = {} as EvmProvider;
        mockPricingProvider = {} as IPricingProvider;
        mockMetadataProvider = {} as IMetadataProvider;
        mockRoundRepository = {} as IRoundReadRepository;

        processor = new AlloV1ToV2ProfileMigrationProcessor(mockChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: {} as IProjectReadRepository,
            applicationRepository: {} as IApplicationReadRepository,
            logger,
        });

        // Reset mocks before each test
        vi.clearAllMocks();
    });

    it("calls ProfileMigratedHandler for ProfileMigrated event", async () => {
        const mockEvent: ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated"> = {
            eventName: "ProfileMigrated",
            // Add other necessary event properties here
        } as ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated">;

        vi.spyOn(ProfileMigratedHandler.prototype, "handle").mockResolvedValue([]);

        await processor.process(mockEvent);

        expect(ProfileMigratedHandler).toHaveBeenCalledWith(
            mockEvent,
            mockChainId,
            processor["dependencies"],
        );
        expect(ProfileMigratedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("throw an error for unknown event names", async () => {
        const mockEvent = {
            eventName: "UnknownEvent",
        } as unknown as ProcessorEvent<"AlloV1ToV2ProfileMigration", "ProfileMigrated">;

        await expect(() => processor.process(mockEvent)).rejects.toThrow(UnsupportedEventException);
    });
});
