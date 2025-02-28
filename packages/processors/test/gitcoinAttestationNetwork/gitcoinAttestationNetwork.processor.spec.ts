import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EvmProvider } from "@grants-stack-indexer/chain-providers";
import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type { IPricingProvider } from "@grants-stack-indexer/pricing";
import type {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import type {
    ChainId,
    GitcoinAttestationNetworkEvent,
    ILogger,
    ProcessorEvent,
} from "@grants-stack-indexer/shared";

import { UnsupportedEventException } from "../../src/internal.js";
import { GitcoinAttestationNetworkProcessor } from "../../src/processors/gitcoinAttestationNetwork/gitcoinAttestationNetwork.processor.js";
import { OnAttestedHandler } from "../../src/processors/gitcoinAttestationNetwork/handlers/index.js";

// Mock the handlers
vi.mock("../../src/processors/gitcoinAttestationNetwork/handlers/index.js", () => {
    const OnAttestedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    OnAttestedHandler.prototype.handle = vi.fn();
    return {
        OnAttestedHandler,
    };
});

describe("GitcoinAttestationNetworkProcessor", () => {
    const mockChainId = 10 as ChainId;
    let processor: GitcoinAttestationNetworkProcessor;
    let mockEvmProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;
    let mockProjectRepository: IProjectReadRepository;
    let mockApplicationRepository: IApplicationReadRepository;
    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    beforeEach(() => {
        mockEvmProvider = {} as EvmProvider;
        mockPricingProvider = {} as IPricingProvider;
        mockMetadataProvider = {
            getMetadata: vi.fn(),
        } as IMetadataProvider;
        mockRoundRepository = {} as IRoundReadRepository;
        mockProjectRepository = {} as IProjectReadRepository;
        mockApplicationRepository = {} as IApplicationReadRepository;

        processor = new GitcoinAttestationNetworkProcessor(mockChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            applicationRepository: mockApplicationRepository,
            logger,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("calls OnAttestedHandler for OnAttested event", async () => {
        const mockEvent: ProcessorEvent<"GitcoinAttestationNetwork", "OnAttested"> = {
            eventName: "OnAttested",
            // Mock event properties will be filled in later
        } as ProcessorEvent<"GitcoinAttestationNetwork", "OnAttested">;

        vi.spyOn(OnAttestedHandler.prototype, "handle").mockResolvedValue([]);

        await processor.process(mockEvent);

        expect(OnAttestedHandler).toHaveBeenCalledWith(
            mockEvent,
            mockChainId,
            processor["dependencies"],
        );
        expect(OnAttestedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("throws an error for unknown event names", async () => {
        const mockEvent = {
            eventName: "UnknownEvent",
        } as unknown as ProcessorEvent<"GitcoinAttestationNetwork", GitcoinAttestationNetworkEvent>;

        await expect(() => processor.process(mockEvent)).rejects.toThrow(UnsupportedEventException);
    });
});
