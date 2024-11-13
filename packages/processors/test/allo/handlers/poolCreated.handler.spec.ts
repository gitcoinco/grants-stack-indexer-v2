import { GetTransactionReturnType, parseUnits } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EvmProvider } from "@grants-stack-indexer/chain-providers";
import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type { IPricingProvider } from "@grants-stack-indexer/pricing";
import type { IRoundReadRepository, Round } from "@grants-stack-indexer/repository";
import type { ChainId, DeepPartial, ProcessorEvent, TokenCode } from "@grants-stack-indexer/shared";
import { mergeDeep } from "@grants-stack-indexer/shared";

import { PoolCreatedHandler } from "../../../src/processors/allo/handlers/poolCreated.handler.js";

// Function to create a mock event with optional overrides
function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"Allo", "PoolCreated">> = {},
): ProcessorEvent<"Allo", "PoolCreated"> {
    const defaultEvent: ProcessorEvent<"Allo", "PoolCreated"> = {
        blockNumber: 116385567,
        blockTimestamp: 1708369911,
        chainId: 10 as ChainId,
        contractName: "Allo",
        eventName: "PoolCreated",
        logIndex: 221,
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        params: {
            strategy: "0xD545fbA3f43EcA447CC7FBF41D4A8F0f575F2491",
            poolId: 10n,
            profileId: "0xcc3509068dfb6604965939f100e57dde21e9d764d8ce4b34284bbe9364b1f5ed",
            amount: 0n,
            token: "0x4200000000000000000000000000000000000042",
            metadata: [1n, "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku"],
        },
        transactionFields: {
            hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
            transactionIndex: 6,
            from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
        strategyId: "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0",
    };

    return mergeDeep(defaultEvent, overrides) as ProcessorEvent<"Allo", "PoolCreated">;
}

describe("PoolCreatedHandler", () => {
    let mockEvmProvider: EvmProvider;
    let mockPricingProvider: IPricingProvider;
    let mockMetadataProvider: IMetadataProvider;
    let mockRoundRepository: IRoundReadRepository;

    beforeEach(() => {
        mockEvmProvider = {
            readContract: vi.fn(),
            getTransaction: vi.fn(),
            multicall: vi.fn(),
            getMulticall3Address: vi.fn().mockRejectedValue("0xmulticall3"),
        } as unknown as EvmProvider;
        mockPricingProvider = {
            getTokenPrice: vi.fn(),
        };
        mockMetadataProvider = {
            getMetadata: vi.fn(),
        };
        mockRoundRepository = {
            getPendingRoundRoles: vi.fn(),
        } as unknown as IRoundReadRepository;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("process an event with initial funds", async () => {
        const fundedAmount = parseUnits("10", 18);
        const mockEvent = createMockEvent({
            params: { amount: fundedAmount },
            strategyId: "0xunknown",
        });

        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            priceUsd: 100,
            timestampMs: 1708369911,
        });
        vi.spyOn(mockRoundRepository, "getPendingRoundRoles").mockResolvedValue([]);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        const changeset = result[0] as { type: "InsertRound"; args: { round: Round } };
        expect(changeset.type).toBe("InsertRound");
        expect(changeset.args.round).toMatchObject({
            fundedAmount: fundedAmount,
            fundedAmountInUsd: "1000",
        });
        expect(mockPricingProvider.getTokenPrice).toHaveBeenCalled();
        expect(mockMetadataProvider.getMetadata).toHaveBeenCalled();
    });

    it("process an unknown strategyId", async () => {
        const mockEvent = createMockEvent({
            strategyId: "0xunknown",
        });

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(undefined);
        vi.spyOn(mockRoundRepository, "getPendingRoundRoles").mockResolvedValue([]);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        const changeset = result[0] as { type: "InsertRound"; args: { round: Round } };
        expect(changeset.type).toBe("InsertRound");
        expect(changeset.args.round).toMatchObject({
            chainId: 10,
            id: "10",
            tags: ["allo-v2"],
            strategyAddress: mockEvent.params.strategy,
            strategyId: "0xunknown",
            strategyName: "",
            createdByAddress: mockEvent.transactionFields.from,
        });
        expect(mockPricingProvider.getTokenPrice).not.toHaveBeenCalled();
        expect(mockEvmProvider.multicall).not.toHaveBeenCalled();
    });

    it("process a DonationVotingMerkleDistributionDirectTransferStrategy", async () => {
        const mockEvent = createMockEvent();

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue({
            round: {
                name: "Test Round",
                roundType: "private",
                quadraticFundingConfig: {
                    matchingFundsAvailable: 1,
                },
            },
            application: {
                version: "1.0.0",
            },
        });

        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            priceUsd: 100,
            timestampMs: 1708369911,
        });
        vi.spyOn(mockEvmProvider, "multicall").mockResolvedValue([
            1609459200n,
            1609459200n,
            1609459200n,
            1609459200n,
        ]);

        vi.spyOn(mockRoundRepository, "getPendingRoundRoles")
            .mockResolvedValueOnce([
                {
                    chainId: 10 as ChainId,
                    role: "admin",
                    address: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
                    createdAtBlock: 116385567n,
                },
            ])
            .mockResolvedValue([]);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        expect(result).toHaveLength(3);

        const changeset = result[0] as { type: "InsertRound"; args: { round: Round } };
        expect(changeset.type).toBe("InsertRound");
        expect(changeset.args.round).toMatchObject({
            chainId: 10,
            id: "10",
            tags: ["allo-v2", "grants-stack"],
            totalDonationsCount: 0,
            totalAmountDonatedInUsd: "0",
            uniqueDonorsCount: 0,
            matchTokenAddress: mockEvent.params.token,
            matchAmount: parseUnits("1", 18),
            matchAmountInUsd: "100",
            fundedAmount: 0n,
            fundedAmountInUsd: "0",
            applicationMetadataCid: "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
            applicationMetadata: {
                version: "1.0.0",
            },
            roundMetadataCid: "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
            roundMetadata: {
                name: "Test Round",
                roundType: "private",
                quadraticFundingConfig: {
                    matchingFundsAvailable: 1,
                },
            },
            applicationsStartTime: new Date("2021-01-01T00:00:00.000Z"),
            applicationsEndTime: new Date("2021-01-01T00:00:00.000Z"),
            donationsStartTime: new Date("2021-01-01T00:00:00.000Z"),
            donationsEndTime: new Date("2021-01-01T00:00:00.000Z"),
            strategyAddress: mockEvent.params.strategy,
            strategyId: "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0",
            strategyName: "allov2.DonationVotingMerkleDistributionDirectTransferStrategy",
            createdByAddress: mockEvent.transactionFields.from,
            createdAtBlock: BigInt(mockEvent.blockNumber),
            updatedAtBlock: BigInt(mockEvent.blockNumber),
            projectId: mockEvent.params.profileId,
            totalDistributed: 0n,
            readyForPayoutTransaction: null,
            matchingDistribution: null,
        });
        expect(mockPricingProvider.getTokenPrice).toHaveBeenCalled();
        expect(mockMetadataProvider.getMetadata).toHaveBeenCalled();
        expect(mockEvmProvider.multicall).toHaveBeenCalled();
    });

    it("fetches transaction sender if not present in event", async () => {
        const mockEvent = createMockEvent({
            strategyId: "0xunknown",
            transactionFields: {
                hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
                from: undefined,
            },
        });

        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            priceUsd: 100,
            timestampMs: 1708369911,
        });
        vi.spyOn(mockRoundRepository, "getPendingRoundRoles").mockResolvedValue([]);
        vi.spyOn(mockEvmProvider, "getTransaction").mockResolvedValue({
            from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        } as unknown as GetTransactionReturnType);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        const changeset = result[0] as { type: "InsertRound"; args: { round: Round } };
        expect(changeset.args.round.createdByAddress).toBe(
            "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        );
        expect(mockEvmProvider.getTransaction).toHaveBeenCalledWith(
            "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
        );
    });

    it("handles an undefined metadata", async () => {
        const mockEvent = createMockEvent();

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(undefined);
        vi.spyOn(mockEvmProvider, "multicall").mockResolvedValue([
            1609459200n,
            1609459200n,
            1609459200n,
            1609459200n,
        ]);
        vi.spyOn(mockRoundRepository, "getPendingRoundRoles").mockResolvedValue([]);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        const changeset = result[0] as { type: "InsertRound"; args: { round: Round } };
        expect(changeset.type).toBe("InsertRound");
        expect(changeset.args.round).toMatchObject({
            chainId: 10,
            id: "10",
            tags: ["allo-v2"],
            matchAmount: 0n,
            matchAmountInUsd: "0",
            fundedAmount: 0n,
            fundedAmountInUsd: "0",
            applicationMetadataCid: "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
            applicationMetadata: {},
            roundMetadataCid: "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku",
            roundMetadata: null,
            readyForPayoutTransaction: null,
            matchingDistribution: null,
        });

        expect(mockPricingProvider.getTokenPrice).not.toHaveBeenCalled();
        expect(mockMetadataProvider.getMetadata).toHaveBeenCalled();
    });

    it("throws an error if token price fetch fails", async () => {
        const mockEvent = createMockEvent({ params: { amount: 1n }, strategyId: "0xunknown" });

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(undefined);

        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue(undefined);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        await expect(() => handler.handle()).rejects.toThrow("Token price not found");
    });

    it("handles pending round roles", async () => {
        const mockEvent = createMockEvent();

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(undefined);
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            priceUsd: 100,
            timestampMs: 1708369911,
        });
        vi.spyOn(mockEvmProvider, "multicall").mockResolvedValue([
            1609459200n,
            1609459200n,
            1609459200n,
            1609459200n,
        ]);

        vi.spyOn(mockRoundRepository, "getPendingRoundRoles")
            .mockResolvedValueOnce([
                {
                    id: 1,
                    chainId: 10 as ChainId,
                    role: "admin",
                    address: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
                    createdAtBlock: 116385565n,
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 2,
                    chainId: 10 as ChainId,
                    role: "manager",
                    address: "0x1234567890123456789012345678901234567890",
                    createdAtBlock: 116385565n,
                },
                {
                    id: 3,
                    chainId: 10 as ChainId,
                    role: "manager",
                    address: "0xAaBBccdDeEFf0000000000000000000000000000",
                    createdAtBlock: 116385565n,
                },
            ]);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        expect(result).toHaveLength(5);

        const changeset = result[0] as { type: "InsertRound"; args: { round: Round } };
        expect(changeset.type).toBe("InsertRound");

        expect(result.filter((c) => c.type === "InsertRoundRole")).toHaveLength(3);
        expect(result.filter((c) => c.type === "InsertRoundRole")[0]?.args.roundRole).toMatchObject(
            {
                chainId: 10 as ChainId,
                roundId: "10",
                role: "admin",
                address: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
                createdAtBlock: 116385565n,
            },
        );
        expect(result.filter((c) => c.type === "InsertRoundRole")[1]?.args.roundRole).toMatchObject(
            {
                chainId: 10 as ChainId,
                roundId: "10",
                role: "manager",
                address: "0x1234567890123456789012345678901234567890",
                createdAtBlock: 116385565n,
            },
        );
        expect(result.filter((c) => c.type === "InsertRoundRole")[2]?.args.roundRole).toMatchObject(
            {
                chainId: 10 as ChainId,
                roundId: "10",
                role: "manager",
                address: "0xAaBBccdDeEFf0000000000000000000000000000",
                createdAtBlock: 116385565n,
            },
        );
        expect(result.filter((c) => c.type === "DeletePendingRoundRoles")).toHaveLength(1);
        expect(result.filter((c) => c.type === "DeletePendingRoundRoles")[0]?.args.ids).toContain(
            1,
        );
        expect(result.filter((c) => c.type === "DeletePendingRoundRoles")[0]?.args.ids).toContain(
            2,
        );
        expect(result.filter((c) => c.type === "DeletePendingRoundRoles")[0]?.args.ids).toContain(
            3,
        );
    });

    it("handles a native token", async () => {
        const mockEvent = createMockEvent({
            params: { token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
        });

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue({
            round: {
                name: "Test Round",
                roundType: "private",
                quadraticFundingConfig: {
                    matchingFundsAvailable: 1,
                },
            },
            application: {
                version: "1.0.0",
            },
        });
        vi.spyOn(mockPricingProvider, "getTokenPrice").mockResolvedValue({
            priceUsd: 2500,
            timestampMs: 1708369911,
        });
        vi.spyOn(mockEvmProvider, "multicall").mockResolvedValue([
            1609459200n,
            1609459200n,
            1609459200n,
            1609459200n,
        ]);

        vi.spyOn(mockRoundRepository, "getPendingRoundRoles").mockResolvedValue([]);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        await handler.handle();

        expect(mockPricingProvider.getTokenPrice).toHaveBeenCalledWith(
            "ETH" as TokenCode,
            1708369911,
        );
    });

    it("handles an unknown token", async () => {
        const fundedAmount = parseUnits("10", 18);
        const mockEvent = createMockEvent({
            params: {
                amount: fundedAmount,
                token: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
            },
            strategyId: "0xunknown",
        });

        vi.spyOn(mockRoundRepository, "getPendingRoundRoles").mockResolvedValue([]);

        const handler = new PoolCreatedHandler(mockEvent, 10 as ChainId, {
            evmProvider: mockEvmProvider,
            pricingProvider: mockPricingProvider,
            metadataProvider: mockMetadataProvider,
            roundRepository: mockRoundRepository,
        });

        const result = await handler.handle();

        const changeset = result[0] as { type: "InsertRound"; args: { round: Round } };
        expect(changeset.type).toBe("InsertRound");
        expect(changeset.args.round).toMatchObject({
            fundedAmount: fundedAmount,
            fundedAmountInUsd: "0", //since it's an unknown token
        });
        expect(mockPricingProvider.getTokenPrice).not.toHaveBeenCalled();
    });
});
