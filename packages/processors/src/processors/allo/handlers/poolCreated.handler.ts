import { getAddress, zeroAddress } from "viem";

import type { Changeset, NewRound, PendingRoundRole } from "@grants-stack-indexer/repository";
import type { ChainId, ProcessorEvent, TimestampMs, Token } from "@grants-stack-indexer/shared";
import { getToken, isAlloNativeToken } from "@grants-stack-indexer/shared";

import type { IEventHandler, ProcessorDependencies, StrategyTimings } from "../../../internal.js";
import { calculateAmountInUsd, getRoundRoles } from "../../../helpers/index.js";
import { StrategyHandlerFactory, TokenPriceNotFoundError } from "../../../internal.js";
import { RoundMetadataSchema } from "../../../schemas/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    | "evmProvider"
    | "pricingProvider"
    | "metadataProvider"
    | "roundRepository"
    | "strategyTimingsRepository"
>;

/**
 /**
  * Handles the PoolCreated event for the Allo protocol.
  * 
  * This handler performs the following core actions when a new pool is created:
  * - Retrieves the metadata associated with the pool
  * - Determines the correct token address, handling native tokens appropriately.
  * - Extracts the correct strategy information from the provided strategy ID.
  * - Calculates the funded amount in USD based on the token's pricing.
  * - Creates a new round object
  */
export class PoolCreatedHandler implements IEventHandler<"Allo", "PoolCreated"> {
    constructor(
        readonly event: ProcessorEvent<"Allo", "PoolCreated">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    async handle(): Promise<Changeset[]> {
        const { metadataProvider, evmProvider, strategyTimingsRepository } = this.dependencies;
        const metadataPointer = this.event.params.metadata[1];
        const {
            poolId,
            token: tokenAddress,
            strategy: strategyAddress,
            amount,
        } = this.event.params;
        const fundedAmount = BigInt(amount);
        const { hash: txHash, from: txFrom } = this.event.transactionFields;
        const strategyId = this.event.strategyId;

        const metadata = await metadataProvider.getMetadata<{
            round?: unknown;
            application?: unknown;
        }>(metadataPointer);
        // TODO: this might not work for other gitcoin strategies like retro funding
        const parsedRoundMetadata = RoundMetadataSchema.safeParse(metadata?.round);

        const checksummedTokenAddress = getAddress(tokenAddress);
        const matchTokenAddress = isAlloNativeToken(checksummedTokenAddress)
            ? zeroAddress
            : checksummedTokenAddress;
        const strategyHandler = StrategyHandlerFactory.createHandler(
            this.chainId,
            this.dependencies as ProcessorDependencies,
            strategyId,
        );

        const token = getToken(this.chainId, matchTokenAddress);

        let strategyTimings: StrategyTimings = {
            applicationsStartTime: null,
            applicationsEndTime: null,
            donationsStartTime: null,
            donationsEndTime: null,
        };
        let matchAmountObj = {
            matchAmount: 0n,
            matchAmountInUsd: "0",
        };

        if (strategyHandler) {
            const strategyTimingsOnRegistry = await strategyTimingsRepository.get(strategyAddress);
            if (strategyTimingsOnRegistry) {
                strategyTimings = strategyTimingsOnRegistry.timings as unknown as StrategyTimings;
            } else {
                strategyTimings = await strategyHandler.fetchStrategyTimings(strategyAddress);
                await strategyTimingsRepository.set(strategyAddress, {
                    address: strategyAddress,
                    timings: JSON.stringify(strategyTimings),
                    strategyId,
                    createdAt: new Date(),
                });
            }
            if (parsedRoundMetadata.success && token) {
                matchAmountObj = await strategyHandler.fetchMatchAmount(
                    Number(parsedRoundMetadata.data.quadraticFundingConfig.matchingFundsAvailable),
                    token,
                    this.event.blockTimestamp,
                );
            }
        }

        let fundedAmountInUsd = "0";

        if (token && fundedAmount > 0n) {
            fundedAmountInUsd = await this.getTokenAmountInUsd(
                token,
                fundedAmount,
                this.event.blockTimestamp,
            );
        }

        // transaction sender
        const createdBy = txFrom ?? (await evmProvider.getTransaction(txHash)).from;
        const roundRoles = getRoundRoles(BigInt(poolId));
        const newRound: NewRound = {
            chainId: this.chainId,
            id: poolId.toString(),
            tags: ["allo-v2", ...(parsedRoundMetadata.success ? ["grants-stack"] : [])],
            totalDonationsCount: 0,
            totalAmountDonatedInUsd: "0",
            uniqueDonorsCount: 0,
            matchTokenAddress,
            matchAmount: matchAmountObj.matchAmount,
            matchAmountInUsd: matchAmountObj.matchAmountInUsd,
            fundedAmount,
            fundedAmountInUsd,
            applicationMetadataCid: metadataPointer,
            applicationMetadata: metadata?.application ?? {},
            roundMetadataCid: metadataPointer,
            roundMetadata: metadata?.round ?? null,
            ...strategyTimings,
            ...roundRoles,
            strategyAddress,
            strategyId,
            strategyName: strategyHandler?.name ?? "",
            createdByAddress: getAddress(createdBy),
            createdAtBlock: BigInt(this.event.blockNumber),
            updatedAtBlock: BigInt(this.event.blockNumber),
            projectId: this.event.params.profileId,
            totalDistributed: 0n,
            readyForPayoutTransaction: null,
            matchingDistribution: null,
            timestamp: new Date(this.event.blockTimestamp),
        };

        const changes: Changeset[] = [
            {
                type: "InsertRound",
                args: { round: newRound },
            },
        ];

        changes.push(...(await this.handlePendingRoles(this.chainId, poolId.toString())));
        return changes;
    }

    /**
     * Creates the admin and manager roles for the pool and deletes the pending roles.
     * @param chainId - The ID of the chain.
     * @param roundId - The ID of the round.
     * @returns The changesets.
     * @Note
     * Admin/Manager roles for the pool are emitted before the pool is created
     * so a pending round role is inserted in the db.
     * Now that the PoolCreated event is emitted, we can convert
     * pending roles to actual round roles.
     */
    private async handlePendingRoles(chainId: ChainId, roundId: string): Promise<Changeset[]> {
        const { roundRepository } = this.dependencies;
        const changes: Changeset[] = [];
        const allPendingRoles: PendingRoundRole[] = [];
        const { adminRole, managerRole } = getRoundRoles(BigInt(roundId));

        for (const roleHash of [adminRole, managerRole] as const) {
            const pendingRoles = await roundRepository.getPendingRoundRoles(chainId, roleHash);
            for (const pr of pendingRoles) {
                changes.push({
                    type: "InsertRoundRole",
                    args: {
                        roundRole: {
                            chainId,
                            roundId,
                            address: pr.address,
                            role: roleHash === adminRole ? "admin" : "manager",
                            createdAtBlock: pr.createdAtBlock,
                        },
                    },
                });
            }
            allPendingRoles.push(...pendingRoles);
        }

        const pendingRoleIds = [...new Set(allPendingRoles.map((r) => r.id!))];
        if (pendingRoleIds.length > 0) {
            changes.push({
                type: "DeletePendingRoundRoles",
                args: { ids: pendingRoleIds },
            });
        }

        return changes;
    }

    private async getTokenAmountInUsd(
        token: Token,
        amount: bigint,
        timestamp: TimestampMs,
    ): Promise<string> {
        const { pricingProvider } = this.dependencies;
        const tokenPrice = await pricingProvider.getTokenPrice(token.priceSourceCode, timestamp);

        if (!tokenPrice) {
            throw new TokenPriceNotFoundError(token.address, timestamp);
        }

        return calculateAmountInUsd(amount, tokenPrice.priceUsd, token.decimals);
    }
}
