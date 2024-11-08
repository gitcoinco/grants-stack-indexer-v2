import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EvmProvider } from "@grants-stack-indexer/chain-providers";
import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type { IPricingProvider } from "@grants-stack-indexer/pricing";
import type {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import type { AlloEvent, ChainId, ILogger, ProcessorEvent } from "@grants-stack-indexer/shared";

import { AlloProcessor } from "../../src/allo/allo.processor.js";
import { PoolCreatedHandler } from "../../src/allo/handlers/poolCreated.handler.js";
import { UnsupportedEventException } from "../../src/internal.js";

// Mock the handlers
vi.mock("../../src/allo/handlers/poolCreated.handler.js", () => {
    const PoolCreatedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    PoolCreatedHandler.prototype.handle = vi.fn();
    return {
        PoolCreatedHandler,
    };
});

describe("AlloProcessor", () => {
    const mockChainId = 10 as ChainId;
    let processor: AlloProcessor;
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

        processor = new AlloProcessor(mockChainId, {
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

    it("call PoolCreatedHandler for PoolCreated event", async () => {
        const mockEvent: ProcessorEvent<"Allo", "PoolCreated"> = {
            eventName: "PoolCreated",
            // Add other necessary event properties here
        } as ProcessorEvent<"Allo", "PoolCreated">;

        vi.spyOn(PoolCreatedHandler.prototype, "handle").mockResolvedValue([]);

        await processor.process(mockEvent);

        expect(PoolCreatedHandler).toHaveBeenCalledWith(
            mockEvent,
            mockChainId,
            processor["dependencies"],
        );
        expect(PoolCreatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("throw an error for unknown event names", async () => {
        const mockEvent = {
            eventName: "UnknownEvent",
        } as unknown as ProcessorEvent<"Allo", AlloEvent>;

        await expect(() => processor.process(mockEvent)).rejects.toThrow(UnsupportedEventException);
    });
});
