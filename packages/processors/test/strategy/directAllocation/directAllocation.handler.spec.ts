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
import {
    Address,
    ChainId,
    ILogger,
    ProcessorEvent,
    StrategyEvent,
} from "@grants-stack-indexer/shared";

import { UnsupportedEventException } from "../../../src/internal.js";
import { DirectAllocationStrategyHandler } from "../../../src/processors/strategy/directAllocation/directAllocation.handler.js";
import { DirectAllocatedHandler } from "../../../src/processors/strategy/directAllocation/handlers/directAllocated.handler.js";

vi.mock(
    "../../../src/processors/strategy/directAllocation/handlers/directAllocated.handler.js",
    () => {
        const DirectAllocatedHandler = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        DirectAllocatedHandler.prototype.handle = vi.fn();
        return { DirectAllocatedHandler };
    },
);

describe("DirectAllocationStrategyHandler", () => {
    let handler: DirectAllocationStrategyHandler;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;
    let mockProjectRepository: IProjectReadRepository;
    let mockEVMProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockApplicationRepository: IApplicationReadRepository;
    let mockLogger: ILogger;
    const chainId = 10 as ChainId;

    beforeEach(() => {
        mockMetadataProvider = {} as IMetadataProvider;
        mockRoundRepository = {} as IRoundReadRepository;
        mockProjectRepository = {} as IProjectReadRepository;
        mockEVMProvider = {} as unknown as EvmProvider;
        mockPricingProvider = {} as IPricingProvider;
        mockApplicationRepository = {} as IApplicationReadRepository;
        mockLogger = {} as ILogger;

        handler = new DirectAllocationStrategyHandler(chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            strategyTimingsRepository: {} as ICache<Address, StrategyTimings>,
            logger: mockLogger,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns correct name", () => {
        expect(handler.name).toBe("allov2.DirectAllocationStrategy");
    });

    it("calls DirectAllocatedHandler for DirectAllocated event", async () => {
        const mockEvent = {
            eventName: "DirectAllocated",
        } as ProcessorEvent<"Strategy", "DirectAllocated">;

        vi.spyOn(DirectAllocatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DirectAllocatedHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger: mockLogger,
        });
        expect(DirectAllocatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("throws UnsupportedEventException for unknown events", async () => {
        const mockEvent = {
            eventName: "UnknownEvent",
        } as unknown as ProcessorEvent<"Strategy", StrategyEvent>;

        await expect(handler.handle(mockEvent)).rejects.toThrow(
            new UnsupportedEventException("Strategy", "UnknownEvent", handler.name),
        );
    });
});
