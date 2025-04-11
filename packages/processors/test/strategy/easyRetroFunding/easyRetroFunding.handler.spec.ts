import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import { ChainId, ILogger, ProcessorEvent, StrategyEvent } from "@grants-stack-indexer/shared";

import { UnsupportedEventException } from "../../../src/internal.js";
import {
    BaseFundsDistributedHandler,
    BaseRecipientStatusUpdatedHandler,
} from "../../../src/processors/strategy/common/index.js";
import { EasyRetroFundingStrategyHandler } from "../../../src/processors/strategy/easyRetroFunding/easyRetroFunding.handler.js";
import {
    ERFDistributionUpdatedHandler,
    ERFRegisteredHandler,
    ERFTimestampsUpdatedHandler,
    ERFUpdatedRegistrationHandler,
} from "../../../src/processors/strategy/easyRetroFunding/handlers/index.js";

vi.mock("../../../src/processors/strategy/easyRetroFunding/handlers/index.js", async () => {
    const ERFRegisteredHandler = vi.fn();
    const ERFTimestampsUpdatedHandler = vi.fn();
    const ERFUpdatedRegistrationHandler = vi.fn();
    const ERFDistributionUpdatedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ERFRegisteredHandler.prototype.handle = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ERFTimestampsUpdatedHandler.prototype.handle = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ERFUpdatedRegistrationHandler.prototype.handle = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ERFDistributionUpdatedHandler.prototype.handle = vi.fn();

    return {
        ERFRegisteredHandler,
        ERFTimestampsUpdatedHandler,
        ERFUpdatedRegistrationHandler,
        ERFDistributionUpdatedHandler,
    };
});

vi.mock("../../../src/processors/strategy/common/index.js", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("../../../src/processors/strategy/common/index.js")>();
    const BaseFundsDistributedHandler = vi.fn();
    const BaseRecipientStatusUpdatedHandler = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    BaseFundsDistributedHandler.prototype.handle = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    BaseRecipientStatusUpdatedHandler.prototype.handle = vi.fn();
    return {
        ...original,
        BaseFundsDistributedHandler,
        BaseRecipientStatusUpdatedHandler,
    };
});

describe("EasyRetroFundingStrategyHandler", () => {
    let handler: EasyRetroFundingStrategyHandler;
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
        handler = new EasyRetroFundingStrategyHandler(chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns correct name", () => {
        expect(handler.name).toBe("allov2.EasyRetroFundingStrategy");
    });

    it("calls RegisteredHandler for Registered event", async () => {
        const mockEvent = {
            eventName: "RegisteredWithSender",
        } as ProcessorEvent<"Strategy", "RegisteredWithSender">;

        vi.spyOn(ERFRegisteredHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(ERFRegisteredHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(ERFRegisteredHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls UpdatedRegistrationHandler for UpdatedRegistration event", async () => {
        const mockEvent = {
            eventName: "UpdatedRegistrationWithStatus",
        } as ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">;

        vi.spyOn(ERFUpdatedRegistrationHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(ERFUpdatedRegistrationHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(ERFUpdatedRegistrationHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls RecipientStatusUpdatedHandler for RecipientStatusUpdated event", async () => {
        const mockEvent = {
            eventName: "RecipientStatusUpdatedWithFullRow",
        } as ProcessorEvent<"Strategy", "RecipientStatusUpdatedWithFullRow">;

        vi.spyOn(BaseRecipientStatusUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(BaseRecipientStatusUpdatedHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(BaseRecipientStatusUpdatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls TimestampsUpdatedHandler for TimestampsUpdated event", async () => {
        const mockEvent = {
            eventName: "TimestampsUpdatedWithRegistrationAndAllocation",
        } as ProcessorEvent<"Strategy", "TimestampsUpdatedWithRegistrationAndAllocation">;

        vi.spyOn(ERFTimestampsUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(ERFTimestampsUpdatedHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(ERFTimestampsUpdatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls ERFDistributionUpdatedHandler for DistributionUpdated event", async () => {
        const mockEvent = {
            eventName: "DistributionUpdated",
        } as ProcessorEvent<"Strategy", "DistributionUpdated">;

        vi.spyOn(ERFDistributionUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(ERFDistributionUpdatedHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(ERFDistributionUpdatedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls FundsDistributedHandler for FundsDistributed event", async () => {
        const mockEvent = {
            eventName: "FundsDistributed",
        } as ProcessorEvent<"Strategy", "FundsDistributed">;

        vi.spyOn(BaseFundsDistributedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(BaseFundsDistributedHandler).toHaveBeenCalledWith(mockEvent, chainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(BaseFundsDistributedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("throws UnsupportedEventException for unknown events", async () => {
        const mockEvent = {
            eventName: "UnknownEvent",
        } as unknown as ProcessorEvent<"Strategy", StrategyEvent>;

        await expect(handler.handle(mockEvent)).rejects.toThrow(UnsupportedEventException);
    });
});
