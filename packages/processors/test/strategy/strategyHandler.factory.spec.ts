import { Address, Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    IApplicationReadRepository,
    ICache,
    IProjectReadRepository,
    IRoundReadRepository,
    StrategyTimings,
} from "@grants-stack-indexer/repository";
import { ChainId, ILogger } from "@grants-stack-indexer/shared";

import { ProcessorDependencies, StrategyHandlerFactory } from "../../src/internal.js";
import { DVMDDirectTransferStrategyHandler } from "../../src/processors/strategy/donationVotingMerkleDistributionDirectTransfer/dvmdDirectTransfer.handler.js";

describe("StrategyHandlerFactory", () => {
    const chainId = 10 as ChainId;
    let mockEvmProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;
    let mockProjectRepository: IProjectReadRepository;
    let mockProcessorDependencies: ProcessorDependencies;
    let mockApplicationRepository: IApplicationReadRepository;
    let mockStrategyTimingsRepository: ICache<Address, StrategyTimings>;
    const logger: ILogger = {
        debug: vi.fn(),
        verbose: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };
    beforeEach(() => {
        mockEvmProvider = {} as EvmProvider;
        mockPricingProvider = {} as IPricingProvider;
        mockMetadataProvider = {} as IMetadataProvider;
        mockRoundRepository = {} as IRoundReadRepository;
        mockProjectRepository = {} as IProjectReadRepository;
        mockApplicationRepository = {} as IApplicationReadRepository;
        mockProcessorDependencies = {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            applicationRepository: mockApplicationRepository,
            strategyTimingsRepository: mockStrategyTimingsRepository,
            logger,
        };
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("creates a DVMDDirectTransferHandler", () => {
        const strategies: Hex[] = [
            "0x6f9291df02b2664139cec5703c124e4ebce32879c74b6297faa1468aa5ff9ebf",
            "0x2f46bf157821dc41daa51479e94783bb0c8699eac63bf75ec450508ab03867ce",
            "0x2f0250d534b2d59b8b5cfa5eb0d0848a59ccbf5de2eaf72d2ba4bfe73dce7c6b",
            "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0",
        ];

        strategies.forEach((strategyId) => {
            const handler = StrategyHandlerFactory.createHandler(
                chainId,
                mockProcessorDependencies,
                strategyId,
            );

            expect(handler).toBeDefined();
            expect(handler).toBeInstanceOf(DVMDDirectTransferStrategyHandler);
        });
    });

    it.skip("creates a DirectGrantsLiteHandler");
    it.skip("creates a DirectGrantsSimpleHandler");

    it("returns undefined if the strategy id is not supported", () => {
        const handler = StrategyHandlerFactory.createHandler(
            chainId,
            mockProcessorDependencies,
            "0xnot-supported",
        );

        expect(handler).toBeUndefined();
    });
});
