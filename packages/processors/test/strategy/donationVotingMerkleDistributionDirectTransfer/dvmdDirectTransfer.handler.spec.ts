import { parseUnits } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import {
    ChainId,
    ILogger,
    ProcessorEvent,
    StrategyEvent,
    Token,
    TokenCode,
} from "@grants-stack-indexer/shared";

import { TokenPriceNotFoundError, UnsupportedEventException } from "../../../src/internal.js";
import { BaseDistributedHandler } from "../../../src/processors/strategy/common/index.js";
import { DVMDDirectTransferStrategyHandler } from "../../../src/processors/strategy/donationVotingMerkleDistributionDirectTransfer/dvmdDirectTransfer.handler.js";
import {
    DVMDAllocatedHandler,
    DVMDRegisteredHandler,
} from "../../../src/processors/strategy/donationVotingMerkleDistributionDirectTransfer/handlers/index.js";

vi.mock(
    "../../../src/processors/strategy/donationVotingMerkleDistributionDirectTransfer/handlers/index.js",
    () => {
        const DVMDRegisteredHandler = vi.fn();
        const DVMDAllocatedHandler = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        DVMDRegisteredHandler.prototype.handle = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        DVMDAllocatedHandler.prototype.handle = vi.fn();
        return {
            DVMDRegisteredHandler,
            DVMDAllocatedHandler,
        };
    },
);
vi.mock("../../../src/processors/strategy/common/baseDistributed.handler.js", () => {
    const BaseDistributedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    BaseDistributedHandler.prototype.handle = vi.fn();
    return {
        BaseDistributedHandler,
    };
});

describe("DVMDDirectTransferHandler", () => {
    const mockChainId = 10 as ChainId;
    let handler: DVMDDirectTransferStrategyHandler;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;
    let mockProjectRepository: IProjectReadRepository;
    let mockEVMProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockApplicationRepository: IApplicationReadRepository;

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
        } as IPricingProvider;
        mockApplicationRepository = {} as IApplicationReadRepository;
        handler = new DVMDDirectTransferStrategyHandler(mockChainId, {
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

    it("gets correct name", () => {
        expect(handler.name).toBe("allov2.DonationVotingMerkleDistributionDirectTransferStrategy");
    });

    it("calls RegisteredHandler for Registered event", async () => {
        const mockEvent = {
            eventName: "RegisteredWithSender",
        } as ProcessorEvent<"Strategy", "RegisteredWithSender">;

        vi.spyOn(DVMDRegisteredHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DVMDRegisteredHandler).toHaveBeenCalledWith(mockEvent, mockChainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(DVMDRegisteredHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls DistributedHandler for Distributed event", async () => {
        const mockEvent = {
            eventName: "DistributedWithRecipientAddress",
        } as ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">;

        vi.spyOn(BaseDistributedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(BaseDistributedHandler).toHaveBeenCalledWith(mockEvent, mockChainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(BaseDistributedHandler.prototype.handle).toHaveBeenCalled();
    });

    it("calls AllocatedHandler for AllocatedWithOrigin event", async () => {
        const mockEvent = {
            eventName: "AllocatedWithOrigin",
        } as ProcessorEvent<"Strategy", "AllocatedWithOrigin">;

        vi.spyOn(DVMDAllocatedHandler.prototype, "handle").mockResolvedValue([]);

        await handler.handle(mockEvent);

        expect(DVMDAllocatedHandler).toHaveBeenCalledWith(mockEvent, mockChainId, {
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
            projectRepository: mockProjectRepository,
            evmProvider: mockEVMProvider,
            pricingProvider: mockPricingProvider,
            applicationRepository: mockApplicationRepository,
            logger,
        });
        expect(DVMDAllocatedHandler.prototype.handle).toHaveBeenCalled();
    });

    describe("fetchMatchAmount", () => {
        it("fetches the correct match amount and USD value", async () => {
            const matchingFundsAvailable = 1000;
            const token: Token = {
                address: "0x1234567890123456789012345678901234567890",
                decimals: 18,
                code: "ETH" as TokenCode,
                priceSourceCode: "ETH" as TokenCode,
            };
            const blockTimestamp = 1625097600;

            vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
                priceUsd: 2000,
                timestampMs: blockTimestamp,
            });

            const result = await handler.fetchMatchAmount(
                matchingFundsAvailable,
                token,
                blockTimestamp,
            );

            expect(result).toEqual({
                matchAmount: parseUnits("1000", 18),
                matchAmountInUsd: "2000000",
            });
        });

        it("throws TokenPriceNotFoundError when price is not available", async () => {
            const matchingFundsAvailable = 1000;
            const token: Token = {
                address: "0x1234567890123456789012345678901234567890",
                decimals: 18,
                code: "ETH" as TokenCode,
                priceSourceCode: "ETH" as TokenCode,
            };
            const blockTimestamp = 1625097600;

            vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue(undefined);

            await expect(
                handler.fetchMatchAmount(matchingFundsAvailable, token, blockTimestamp),
            ).rejects.toThrow(TokenPriceNotFoundError);
        });
    });

    describe("fetchStrategyTimings", () => {
        it("fetches correct timings using multicall", async () => {
            const strategyId = "0x1234567890123456789012345678901234567890";
            const mockTimings = [1000n, 2000n, 3000n, 4000n];

            vi.spyOn(mockEVMProvider, "getMulticall3Address").mockReturnValue("0xmulticalladdress");
            vi.spyOn(mockEVMProvider, "multicall").mockResolvedValue(mockTimings);

            const result = await handler.fetchStrategyTimings(strategyId);

            expect(result).toEqual({
                applicationsStartTime: new Date(Number(mockTimings[0]) * 1000),
                applicationsEndTime: new Date(Number(mockTimings[1]) * 1000),
                donationsStartTime: new Date(Number(mockTimings[2]) * 1000),
                donationsEndTime: new Date(Number(mockTimings[3]) * 1000),
            });

            expect(mockEVMProvider.multicall).toHaveBeenCalled();
            expect(mockEVMProvider.readContract).not.toHaveBeenCalled();
        });

        it("fetches correct timings when multicall is not available", async () => {
            const strategyId = "0x1234567890123456789012345678901234567890";
            const mockTimings = [1000n, 2000n, 3000n, 4000n];

            vi.spyOn(mockEVMProvider, "getMulticall3Address").mockReturnValue(undefined);
            vi.spyOn(mockEVMProvider, "readContract").mockImplementation((_, __, functionName) => {
                switch (functionName) {
                    case "registrationStartTime":
                        return Promise.resolve(mockTimings[0]);
                    case "registrationEndTime":
                        return Promise.resolve(mockTimings[1]);
                    case "allocationStartTime":
                        return Promise.resolve(mockTimings[2]);
                    case "allocationEndTime":
                        return Promise.resolve(mockTimings[3]);
                    default:
                        return Promise.resolve(undefined);
                }
            });

            const result = await handler.fetchStrategyTimings(strategyId);

            expect(result).toEqual({
                applicationsStartTime: new Date(Number(mockTimings[0]) * 1000),
                applicationsEndTime: new Date(Number(mockTimings[1]) * 1000),
                donationsStartTime: new Date(Number(mockTimings[2]) * 1000),
                donationsEndTime: new Date(Number(mockTimings[3]) * 1000),
            });

            expect(mockEVMProvider.readContract).toHaveBeenCalledTimes(4);
            expect(mockEVMProvider.multicall).not.toHaveBeenCalled();
        });
    });

    it.skip("calls TimestampsUpdatedHandler for TimestampsUpdated event");
    it.skip("calls RecipientStatusUpdatedHandler for RecipientStatusUpdated event");
    it.skip("calls DistributionUpdatedHandler for DistributionUpdated event");
    it.skip("calls UpdatedRegistrationHandler for UpdatedRegistration event");
    it.skip("calls FundsDistributedHandler for FundsDistributed event");

    it("throws UnsupportedEventException for unknown event names", async () => {
        const mockEvent = { eventName: "UnknownEvent" } as unknown as ProcessorEvent<
            "Strategy",
            StrategyEvent
        >;
        await expect(() => handler.handle(mockEvent)).rejects.toThrow(UnsupportedEventException);
    });
});
