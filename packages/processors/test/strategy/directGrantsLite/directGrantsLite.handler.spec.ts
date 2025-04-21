import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type {
    IApplicationReadRepository,
    ICache,
    IProjectReadRepository,
    IRoundReadRepository,
    StrategyTimings,
} from "@grants-stack-indexer/repository";
import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    Address,
    ChainId,
    ILogger,
    ProcessorEvent,
    StrategyEvent,
} from "@grants-stack-indexer/shared";

import { ProcessorDependencies, UnsupportedEventException } from "../../../src/internal.js";
import { BaseRecipientStatusUpdatedHandler } from "../../../src/processors/strategy/common/index.js";
import {
    DGLiteAllocatedHandler,
    DGLiteRegisteredHandler,
    DGLiteTimestampsUpdatedHandler,
    DGLiteUpdatedRegistrationHandler,
    DirectGrantsLiteStrategyHandler,
} from "../../../src/processors/strategy/directGrantsLite/index.js";

vi.mock("../../../src/processors/strategy/directGrantsLite/handlers/index.js", () => {
    const DGLiteRegisteredHandler = vi.fn();
    const DGLiteAllocatedHandler = vi.fn();
    const DGLiteTimestampsUpdatedHandler = vi.fn();
    const DGLiteUpdatedRegistrationHandler = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    DGLiteRegisteredHandler.prototype.handle = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    DGLiteAllocatedHandler.prototype.handle = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    DGLiteTimestampsUpdatedHandler.prototype.handle = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    DGLiteUpdatedRegistrationHandler.prototype.handle = vi.fn();

    return {
        DGLiteRegisteredHandler,
        DGLiteAllocatedHandler,
        DGLiteTimestampsUpdatedHandler,
        DGLiteUpdatedRegistrationHandler,
    };
});
vi.mock("../../../src/processors/strategy/common/index.js", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("../../../src/processors/strategy/common/index.js")>();

    const BaseRecipientStatusUpdatedHandler = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    BaseRecipientStatusUpdatedHandler.prototype.handle = vi.fn();
    return {
        ...original,
        BaseRecipientStatusUpdatedHandler,
    };
});

describe("DirectGrantsLiteStrategyHandler", () => {
    const mockChainId = 10 as ChainId;
    let handler: DirectGrantsLiteStrategyHandler;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;
    let mockProjectRepository: IProjectReadRepository;
    let mockEVMProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockApplicationRepository: IApplicationReadRepository;
    let dependencies: ProcessorDependencies;

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
        mockEVMProvider = {
            getMulticall3Address: vi.fn(),
            multicall: vi.fn(),
            readContract: vi.fn(),
        } as unknown as EvmProvider;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
            getTokenPrices: vi.fn(),
        } as IPricingProvider;
        mockApplicationRepository = {} as IApplicationReadRepository;
        dependencies = {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            strategyTimingsRepository: {} as ICache<Address, StrategyTimings>,
            logger,
        };
        handler = new DirectGrantsLiteStrategyHandler(mockChainId, dependencies);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("gets correct name", () => {
        expect(handler.name).toBe("allov2.DirectGrantsLiteStrategy");
    });

    it("calls RegisteredHandler for RegisteredWithSender event", async () => {
        const mockEvent = {
            eventName: "RegisteredWithSender",
        } as ProcessorEvent<"Strategy", "RegisteredWithSender">;

        vi.spyOn(DGLiteRegisteredHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DGLiteRegisteredHandler).toHaveBeenCalledWith(mockEvent, mockChainId, dependencies);
        expect(DGLiteRegisteredHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls AllocatedHandler for AllocatedWithToken event", async () => {
        const mockEvent = {
            eventName: "AllocatedWithToken",
        } as ProcessorEvent<"Strategy", "AllocatedWithToken">;

        vi.spyOn(DGLiteAllocatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DGLiteAllocatedHandler).toHaveBeenCalledWith(mockEvent, mockChainId, dependencies);
        expect(DGLiteAllocatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls TimestampsUpdatedHandler for TimestampsUpdated event", async () => {
        const mockEvent = {
            eventName: "TimestampsUpdated",
        } as ProcessorEvent<"Strategy", "TimestampsUpdated">;

        vi.spyOn(DGLiteTimestampsUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DGLiteTimestampsUpdatedHandler).toHaveBeenCalledWith(
            mockEvent,
            mockChainId,
            dependencies,
        );
        expect(DGLiteTimestampsUpdatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls RecipientStatusUpdatedHandler for RecipientStatusUpdatedWithFullRow event", async () => {
        const mockEvent = {
            eventName: "RecipientStatusUpdatedWithFullRow",
        } as ProcessorEvent<"Strategy", "RecipientStatusUpdatedWithFullRow">;

        vi.spyOn(BaseRecipientStatusUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(BaseRecipientStatusUpdatedHandler).toHaveBeenCalledWith(
            mockEvent,
            mockChainId,
            dependencies,
        );
        expect(BaseRecipientStatusUpdatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls UpdatedRegistrationHandler for UpdatedRegistrationWithStatus event", async () => {
        const mockEvent = {
            eventName: "UpdatedRegistrationWithStatus",
        } as ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">;

        vi.spyOn(DGLiteUpdatedRegistrationHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DGLiteUpdatedRegistrationHandler).toHaveBeenCalledWith(
            mockEvent,
            mockChainId,
            dependencies,
        );
        expect(DGLiteUpdatedRegistrationHandler.prototype.handle).toHaveBeenCalled();
    });

    describe("fetchStrategyTimings", () => {
        it("fetches correct timings using multicall", async () => {
            const strategyId = "0x1234567890123456789012345678901234567890";
            const mockTimings = [1000n, 2000n];

            vi.spyOn(mockEVMProvider, "getMulticall3Address").mockReturnValue("0xmulticalladdress");
            vi.spyOn(mockEVMProvider, "multicall").mockResolvedValue(mockTimings);

            const result = await handler.fetchStrategyTimings(strategyId);

            expect(result).toEqual({
                applicationsStartTime: new Date(Number(mockTimings[0]) * 1000),
                applicationsEndTime: new Date(Number(mockTimings[1]) * 1000),
                donationsStartTime: null,
                donationsEndTime: null,
            });

            expect(mockEVMProvider.multicall).toHaveBeenCalled();
            expect(mockEVMProvider.readContract).not.toHaveBeenCalled();
        });

        it("fetches correct timings when multicall is not available", async () => {
            const strategyId = "0x1234567890123456789012345678901234567890";
            const mockTimings = [1000n, 2000n];

            vi.spyOn(mockEVMProvider, "getMulticall3Address").mockReturnValue(undefined);
            vi.spyOn(mockEVMProvider, "readContract").mockImplementation((_, __, functionName) => {
                switch (functionName) {
                    case "registrationStartTime":
                        return Promise.resolve(mockTimings[0]);
                    case "registrationEndTime":
                        return Promise.resolve(mockTimings[1]);
                    default:
                        return Promise.resolve(undefined);
                }
            });

            const result = await handler.fetchStrategyTimings(strategyId);

            expect(result).toEqual({
                applicationsStartTime: new Date(Number(mockTimings[0]) * 1000),
                applicationsEndTime: new Date(Number(mockTimings[1]) * 1000),
                donationsStartTime: null,
                donationsEndTime: null,
            });

            expect(mockEVMProvider.readContract).toHaveBeenCalledTimes(2);
            expect(mockEVMProvider.multicall).not.toHaveBeenCalled();
        });
    });

    it("throws UnsupportedEventException for unknown event names", async () => {
        const mockEvent = { eventName: "UnknownEvent" } as unknown as ProcessorEvent<
            "Strategy",
            StrategyEvent
        >;
        await expect(() => handler.handle(mockEvent)).rejects.toThrow(
            new UnsupportedEventException("Strategy", "UnknownEvent", handler.name),
        );
    });
});
