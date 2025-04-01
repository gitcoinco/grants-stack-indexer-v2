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
    "evmProvider" | "pricingProvider" | "metadataProvider" | "roundRepository" | "logger"
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
    ) {
        this.dependencies.logger?.debug("Initializing PoolCreatedHandler", {
            className: "PoolCreatedHandler",
            chainId: this.chainId,
            poolId: this.event.params.poolId,
            blockNumber: this.event.blockNumber,
        });
    }

    async handle(): Promise<Changeset[]> {
        const { metadataProvider, evmProvider, logger } = this.dependencies;
        const metadataPointer = this.event.params.metadata[1];
        const {
            poolId,
            token: tokenAddress,
            strategy: strategyAddress,
            amount,
        } = this.event.params;

        logger?.debug("Starting pool creation handling", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            poolId: poolId.toString(),
            strategyAddress,
            tokenAddress,
            amount: amount.toString(),
            metadataPointer,
        });

        const fundedAmount = BigInt(amount);
        const { hash: txHash, from: txFrom } = this.event.transactionFields;
        const strategyId = this.event.strategyId;

        logger?.debug("Fetching pool metadata", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            metadataPointer,
            poolId: poolId.toString(),
        });

        const metadata = await metadataProvider.getMetadata<{
            round?: unknown;
            application?: unknown;
        }>(metadataPointer);

        logger?.debug("Parsing round metadata", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            hasRoundMetadata: !!metadata?.round,
            hasApplicationMetadata: !!metadata?.application,
            poolId: poolId.toString(),
        });

        const parsedRoundMetadata = RoundMetadataSchema.safeParse(metadata?.round);

        logger?.debug("Round metadata validation result", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            isValid: parsedRoundMetadata.success,
            poolId: poolId.toString(),
        });

        const checksummedTokenAddress = getAddress(tokenAddress);
        const matchTokenAddress = isAlloNativeToken(checksummedTokenAddress)
            ? zeroAddress
            : checksummedTokenAddress;

        logger?.debug("Creating strategy handler", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            strategyId,
            poolId: poolId.toString(),
        });

        const strategyHandler = StrategyHandlerFactory.createHandler(
            this.chainId,
            this.dependencies as ProcessorDependencies,
            strategyId,
        );

        const token = getToken(this.chainId, matchTokenAddress);
        logger?.debug("Token details", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            hasToken: !!token,
            tokenAddress: matchTokenAddress,
            isNative: isAlloNativeToken(checksummedTokenAddress),
            poolId: poolId.toString(),
        });

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
            logger?.debug("Fetching strategy timings", {
                className: "PoolCreatedHandler",
                methodName: "handle",
                strategyAddress,
                poolId: poolId.toString(),
            });

            strategyTimings = await strategyHandler.fetchStrategyTimings(strategyAddress);

            logger?.debug("Strategy timings fetched", {
                className: "PoolCreatedHandler",
                methodName: "handle",
                timings: strategyTimings,
                poolId: poolId.toString(),
            });

            if (parsedRoundMetadata.success && token) {
                logger?.debug("Fetching match amount", {
                    className: "PoolCreatedHandler",
                    methodName: "handle",
                    matchingFundsAvailable:
                        parsedRoundMetadata.data.quadraticFundingConfig.matchingFundsAvailable,
                    poolId: poolId.toString(),
                });

                matchAmountObj = await strategyHandler.fetchMatchAmount(
                    Number(parsedRoundMetadata.data.quadraticFundingConfig.matchingFundsAvailable),
                    token,
                    this.event.blockTimestamp,
                );

                logger?.debug("Match amount fetched", {
                    className: "PoolCreatedHandler",
                    methodName: "handle",
                    matchAmount: matchAmountObj.matchAmount.toString(),
                    matchAmountInUsd: matchAmountObj.matchAmountInUsd,
                    poolId: poolId.toString(),
                });
            }
        }

        let fundedAmountInUsd = "0";

        if (token && fundedAmount > 0n) {
            logger?.debug("Calculating funded amount in USD", {
                className: "PoolCreatedHandler",
                methodName: "handle",
                fundedAmount: fundedAmount.toString(),
                tokenAddress: token.address,
                poolId: poolId.toString(),
            });

            fundedAmountInUsd = await this.getTokenAmountInUsd(
                token,
                fundedAmount,
                this.event.blockTimestamp,
            );

            logger?.debug("Funded amount in USD calculated", {
                className: "PoolCreatedHandler",
                methodName: "handle",
                fundedAmountInUsd,
                poolId: poolId.toString(),
            });
        }

        const createdBy = txFrom ?? (await evmProvider.getTransaction(txHash)).from;
        const roundRoles = getRoundRoles(BigInt(poolId));

        logger?.debug("Creating new round object", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            poolId: poolId.toString(),
            createdBy,
            strategyName: strategyHandler?.name ?? "",
        });

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

        logger?.debug("Handling pending roles", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            poolId: poolId.toString(),
        });

        const pendingRoleChanges = await this.handlePendingRoles(this.chainId, poolId.toString());
        changes.push(...pendingRoleChanges);

        logger?.info("Pool creation handling completed", {
            className: "PoolCreatedHandler",
            methodName: "handle",
            poolId: poolId.toString(),
            changeCount: changes.length,
        });

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
        const { roundRepository, logger } = this.dependencies;
        const changes: Changeset[] = [];
        const allPendingRoles: PendingRoundRole[] = [];
        const { adminRole, managerRole } = getRoundRoles(BigInt(roundId));

        logger?.debug("Starting pending roles handling", {
            className: "PoolCreatedHandler",
            methodName: "handlePendingRoles",
            roundId,
            adminRole,
            managerRole,
        });

        for (const roleHash of [adminRole, managerRole] as const) {
            logger?.debug("Fetching pending roles", {
                className: "PoolCreatedHandler",
                methodName: "handlePendingRoles",
                roundId,
                roleHash,
            });

            const pendingRoles = await roundRepository.getPendingRoundRoles(chainId, roleHash);

            logger?.debug("Processing pending roles", {
                className: "PoolCreatedHandler",
                methodName: "handlePendingRoles",
                roundId,
                roleHash,
                pendingRolesCount: pendingRoles.length,
            });

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
            logger?.debug("Deleting processed pending roles", {
                className: "PoolCreatedHandler",
                methodName: "handlePendingRoles",
                roundId,
                pendingRoleCount: pendingRoleIds.length,
            });

            changes.push({
                type: "DeletePendingRoundRoles",
                args: { ids: pendingRoleIds },
            });
        }

        logger?.debug("Pending roles handling completed", {
            className: "PoolCreatedHandler",
            methodName: "handlePendingRoles",
            roundId,
            totalChanges: changes.length,
        });

        return changes;
    }

    private async getTokenAmountInUsd(
        token: Token,
        amount: bigint,
        timestamp: TimestampMs,
    ): Promise<string> {
        const { pricingProvider, logger } = this.dependencies;

        logger?.debug("Fetching token price", {
            className: "PoolCreatedHandler",
            methodName: "getTokenAmountInUsd",
            tokenAddress: token.address,
            priceSourceCode: token.priceSourceCode,
            timestamp,
        });

        const tokenPrice = await pricingProvider.getTokenPrice(token.priceSourceCode, timestamp);

        if (!tokenPrice) {
            logger?.error("Token price not found", {
                className: "PoolCreatedHandler",
                methodName: "getTokenAmountInUsd",
                tokenAddress: token.address,
                timestamp,
            });
            throw new TokenPriceNotFoundError(token.address, timestamp);
        }

        logger?.debug("Calculating USD amount", {
            className: "PoolCreatedHandler",
            methodName: "getTokenAmountInUsd",
            tokenAddress: token.address,
            amount: amount.toString(),
            priceUsd: tokenPrice.priceUsd,
            decimals: token.decimals,
        });

        return calculateAmountInUsd(amount, tokenPrice.priceUsd, token.decimals);
    }
}
