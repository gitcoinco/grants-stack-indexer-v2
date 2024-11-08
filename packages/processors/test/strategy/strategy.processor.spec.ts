import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EvmProvider } from "@grants-stack-indexer/chain-providers";
import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type { IPricingProvider } from "@grants-stack-indexer/pricing";
import type {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import type { ChainId, ProcessorEvent, StrategyEvent } from "@grants-stack-indexer/shared";

import { StrategyProcessor, UnsupportedStrategy } from "../../src/internal.js";

describe("StrategyProcessor", () => {
    const mockChainId = 10 as ChainId;
    let processor: StrategyProcessor;
    let mockEvmProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;

    beforeEach(() => {
        mockEvmProvider = {} as EvmProvider;
        mockPricingProvider = {} as IPricingProvider;
        mockMetadataProvider = {} as IMetadataProvider;
        mockRoundRepository = {} as IRoundReadRepository;

        processor = new StrategyProcessor(mockChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: {} as IProjectReadRepository,
            applicationRepository: {} as IApplicationReadRepository,
        });

        // Reset mocks before each test
        vi.clearAllMocks();
    });

    it("throw an error for unknown strategyId", async () => {
        const mockEvent = {
            eventName: "UnknownEvent",
            strategyId: "0xunknown",
        } as unknown as ProcessorEvent<"Strategy", StrategyEvent>;

        await expect(() => processor.process(mockEvent)).rejects.toThrow(UnsupportedStrategy);
    });
});
