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

import { UnsupportedEventException } from "../../../src/exceptions/index.js";
import { BaseDistributedHandler } from "../../../src/processors/strategy/common/index.js";
import { DGSimpleStrategyHandler } from "../../../src/processors/strategy/directGrantsSimple/directGrantsSimple.handler.js";
import {
    DGSimpleRegisteredHandler,
    DGSimpleTimestampsUpdatedHandler,
} from "../../../src/processors/strategy/directGrantsSimple/handlers/index.js";

vi.mock("../../../src/processors/strategy/directGrantsSimple/handlers/index.js", () => {
    const DGSimpleRegisteredHandler = vi.fn();
    const DGSimpleTimestampsUpdatedHandler = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    DGSimpleRegisteredHandler.prototype.handle = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    DGSimpleTimestampsUpdatedHandler.prototype.handle = vi.fn();

    return {
        DGSimpleRegisteredHandler,
        DGSimpleTimestampsUpdatedHandler,
    };
});

vi.mock("../../../src/processors/strategy/common/baseDistributed.handler.js", () => {
    const BaseDistributedHandler = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    BaseDistributedHandler.prototype.handle = vi.fn();

    return {
        BaseDistributedHandler,
    };
});

describe("DirectGrantsSimpleStrategyHandler", () => {
    let handler: DGSimpleStrategyHandler;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;
    let mockProjectRepository: IProjectReadRepository;
    let mockEVMProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockApplicationRepository: IApplicationReadRepository;
    const chainId = 10 as ChainId;

    const logger: ILogger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    beforeEach(() => {
        mockMetadataProvider = {} as IMetadataProvider;
        mockRoundRepository = {} as IRoundReadRepository;
        mockProjectRepository = {} as IProjectReadRepository;
        mockEVMProvider = {} as EvmProvider;
        mockPricingProvider = {} as IPricingProvider;
        mockApplicationRepository = {} as IApplicationReadRepository;

        handler = new DGSimpleStrategyHandler(chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            strategyTimingsRepository: {} as ICache<Address, StrategyTimings>,
            logger,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns correct name", () => {
        expect(handler.name).toBe("allov2.DirectGrantsSimpleStrategy");
    });

    it("calls DGSimpleTimestampsUpdatedHandler for TimestampsUpdated event", async () => {
        const mockEvent = {
            eventName: "TimestampsUpdated",
        } as ProcessorEvent<"Strategy", "TimestampsUpdated">;

        vi.spyOn(DGSimpleTimestampsUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DGSimpleTimestampsUpdatedHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            strategyTimingsRepository: expect.any(Object),
            logger,
        });
        expect(DGSimpleTimestampsUpdatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls DGSimpleRegisteredHandler for RegisteredWithSender event", async () => {
        const mockEvent = {
            eventName: "RegisteredWithSender",
        } as ProcessorEvent<"Strategy", "RegisteredWithSender">;

        vi.spyOn(DGSimpleRegisteredHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DGSimpleRegisteredHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            strategyTimingsRepository: expect.any(Object),
            logger,
        });
        expect(DGSimpleRegisteredHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls BaseDistributedHandler for DistributedWithRecipientAddress event", async () => {
        const mockEvent = {
            eventName: "DistributedWithRecipientAddress",
        } as ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">;

        vi.spyOn(BaseDistributedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(BaseDistributedHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            strategyTimingsRepository: expect.any(Object),
            logger,
        });
        expect(BaseDistributedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("throws UnsupportedEventException for unknown events", async () => {
        const mockEvent = {
            eventName: "UnknownEvent",
        } as unknown as ProcessorEvent<"Strategy", StrategyEvent>;

        await expect(handler.handle(mockEvent)).rejects.toThrow(UnsupportedEventException);
    });
});
