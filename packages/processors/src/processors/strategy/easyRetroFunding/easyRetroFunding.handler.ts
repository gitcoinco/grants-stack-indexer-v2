import { parseUnits } from "viem";

import { Changeset } from "@grants-stack-indexer/repository";
import {
    Address,
    ChainId,
    ProcessorEvent,
    StrategyEvent,
    TimestampMs,
    Token,
} from "@grants-stack-indexer/shared";

import EasyRetroFundingStrategy from "../../../abis/allo-v2/v1/EasyRetroFundingStrategy.js";
import { calculateAmountInUsd, getDateFromTimestamp } from "../../../helpers/index.js";
import {
    getHandler,
    ProcessorDependencies,
    StrategyTimings,
    TokenPriceNotFoundError,
    UnsupportedEventException,
} from "../../../internal.js";
import {
    BaseDistributionUpdatedHandler,
    BaseFundsDistributedHandler,
    BaseRecipientStatusUpdatedHandler,
    BaseStrategyHandler,
} from "../common/index.js";
import {
    ERFRegisteredHandler,
    ERFTimestampsUpdatedHandler,
    ERFUpdatedRegistrationHandler,
} from "./handlers/index.js";

const STRATEGY_NAME = "allov2.EasyRetroFundingStrategy";

/**
 * This handler is responsible for processing events related to the
 * Easy Retro Funding strategy.
 *
 * The following events are currently handled by this strategy:
 * - RegisteredWithSender
 * - UpdatedRegistrationWithStatus
 * - TimestampsUpdatedWithRegistrationAndAllocation
 * - DistributionUpdated
 * - FundsDistributed
 */
export class EasyRetroFundingStrategyHandler extends BaseStrategyHandler {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {
        super(STRATEGY_NAME);
        this.dependencies.logger?.debug("Initializing EasyRetroFundingStrategyHandler", {
            className: "EasyRetroFundingStrategyHandler",
            chainId: this.chainId,
            strategyName: STRATEGY_NAME,
        });
    }

    /** @inheritdoc */
    async handle(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        const { logger } = this.dependencies;

        logger?.debug("Processing strategy event", {
            className: "EasyRetroFundingStrategyHandler",
            methodName: "handle",
            eventName: event.eventName,
            strategyAddress: event.srcAddress,
            blockNumber: event.blockNumber,
        });

        try {
            let result: Changeset[];
            switch (event.eventName) {
                case "RegisteredWithSender":
                    logger?.debug("Delegating to ERFRegisteredHandler", {
                        className: "EasyRetroFundingStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new ERFRegisteredHandler(
                        event as ProcessorEvent<"Strategy", "RegisteredWithSender">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "UpdatedRegistrationWithStatus":
                    result = await new ERFUpdatedRegistrationHandler(
                        event as ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "RecipientStatusUpdatedWithFullRow":
                    result = await new BaseRecipientStatusUpdatedHandler(
                        event as ProcessorEvent<"Strategy", "RecipientStatusUpdatedWithFullRow">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "TimestampsUpdatedWithRegistrationAndAllocation":
                    result = await new ERFTimestampsUpdatedHandler(
                        event as ProcessorEvent<
                            "Strategy",
                            "TimestampsUpdatedWithRegistrationAndAllocation"
                        >,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "DistributionUpdated":
                    result = await new BaseDistributionUpdatedHandler(
                        event as ProcessorEvent<"Strategy", "DistributionUpdated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "FundsDistributed":
                    result = await new BaseFundsDistributedHandler(
                        event as ProcessorEvent<"Strategy", "FundsDistributed">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                default:
                    logger?.warn("Unsupported event received", {
                        className: "EasyRetroFundingStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                        strategyName: this.name,
                    });
                    throw new UnsupportedEventException("Strategy", event.eventName, this.name);
            }

            logger?.debug("Event processing completed", {
                className: "EasyRetroFundingStrategyHandler",
                methodName: "handle",
                eventName: event.eventName,
                changeCount: result.length,
            });

            return result;
        } catch (error) {
            logger?.error("Error processing event", {
                className: "EasyRetroFundingStrategyHandler",
                methodName: "handle",
                eventName: event.eventName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /** @inheritdoc */
    override async fetchMatchAmount(
        matchingFundsAvailable: number,
        token: Token,
        blockTimestamp: TimestampMs,
    ): Promise<{ matchAmount: bigint; matchAmountInUsd: string }> {
        const { logger } = this.dependencies;

        logger?.debug("Fetching match amount", {
            className: "EasyRetroFundingStrategyHandler",
            methodName: "fetchMatchAmount",
            matchingFundsAvailable,
            tokenAddress: token.address,
            blockTimestamp,
        });

        const matchAmount = parseUnits(matchingFundsAvailable.toString(), token.decimals);
        const matchAmountInUsd = await this.getTokenAmountInUsd(token, matchAmount, blockTimestamp);

        logger?.debug("Match amount calculation completed", {
            className: "EasyRetroFundingStrategyHandler",
            methodName: "fetchMatchAmount",
            matchAmount: matchAmount.toString(),
            matchAmountInUsd,
        });

        return { matchAmount, matchAmountInUsd };
    }

    /** @inheritdoc */
    override async fetchStrategyTimings(strategyId: Address): Promise<StrategyTimings> {
        const { evmProvider, logger } = this.dependencies;

        logger?.debug("Fetching strategy timings", {
            className: "EasyRetroFundingStrategyHandler",
            methodName: "fetchStrategyTimings",
            strategyId: getHandler(strategyId),
            chainId: this.chainId,
        });

        let results: [bigint, bigint, bigint, bigint] = [0n, 0n, 0n, 0n];
        const contractCalls = [
            {
                abi: EasyRetroFundingStrategy,
                functionName: "registrationStartTime",
                address: strategyId,
            },
            {
                abi: EasyRetroFundingStrategy,
                functionName: "registrationEndTime",
                address: strategyId,
            },
            {
                abi: EasyRetroFundingStrategy,
                functionName: "poolStartTime",
                address: strategyId,
            },
            {
                abi: EasyRetroFundingStrategy,
                functionName: "poolEndTime",
                address: strategyId,
            },
        ] as const;

        try {
            if (evmProvider.getMulticall3Address()) {
                logger?.debug("Using multicall for fetching timings", {
                    className: "EasyRetroFundingStrategyHandler",
                    methodName: "fetchStrategyTimings",
                    multicallAddress: evmProvider.getMulticall3Address(),
                });
                results = await evmProvider.multicall({
                    contracts: contractCalls,
                    allowFailure: false,
                });
            } else {
                logger?.debug("Using individual calls for fetching timings", {
                    className: "EasyRetroFundingStrategyHandler",
                    methodName: "fetchStrategyTimings",
                });
                results = (await Promise.all(
                    contractCalls.map((call) =>
                        evmProvider.readContract(call.address, call.abi, call.functionName),
                    ),
                )) as [bigint, bigint, bigint, bigint];
            }

            const timings = {
                applicationsStartTime: getDateFromTimestamp(results[0]),
                applicationsEndTime: getDateFromTimestamp(results[1]),
                donationsStartTime: getDateFromTimestamp(results[2]),
                donationsEndTime: getDateFromTimestamp(results[3]),
            };

            logger?.debug("Strategy timings fetched", {
                className: "EasyRetroFundingStrategyHandler",
                methodName: "fetchStrategyTimings",
                strategyId: getHandler(strategyId),
                chainId: this.chainId,
                timings: {
                    applicationsStartTime: timings.applicationsStartTime?.toISOString(),
                    applicationsEndTime: timings.applicationsEndTime?.toISOString(),
                    donationsStartTime: timings.donationsStartTime?.toISOString(),
                    donationsEndTime: timings.donationsEndTime?.toISOString(),
                },
            });

            return timings;
        } catch (error) {
            logger?.error("Error fetching strategy timings", {
                className: "EasyRetroFundingStrategyHandler",
                methodName: "fetchStrategyTimings",
                strategyId: getHandler(strategyId),
                chainId: this.chainId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Get the amount in USD for a given token and amount and timestamp
     * @param token - The token
     * @param amount - The amount
     * @param timestamp - The timestamp
     * @returns The amount in USD
     * @throws TokenPriceNotFoundError if the token price is not found
     */
    private async getTokenAmountInUsd(
        token: Token,
        amount: bigint,
        timestamp: TimestampMs,
    ): Promise<string> {
        const { pricingProvider, logger } = this.dependencies;

        logger?.debug("Getting token amount in USD", {
            className: "EasyRetroFundingStrategyHandler",
            methodName: "getTokenAmountInUsd",
            tokenAddress: token.address,
            amount: amount.toString(),
            timestamp,
        });

        const tokenPrice = await pricingProvider.getTokenPrice(token.priceSourceCode, timestamp);

        if (!tokenPrice) {
            logger?.error("Token price not found", {
                className: "EasyRetroFundingStrategyHandler",
                methodName: "getTokenAmountInUsd",
                tokenAddress: token.address,
                timestamp,
            });
            throw new TokenPriceNotFoundError(token.address, timestamp);
        }

        const amountInUsd = calculateAmountInUsd(amount, tokenPrice.priceUsd, token.decimals);

        logger?.debug("Token amount in USD calculated", {
            className: "EasyRetroFundingStrategyHandler",
            methodName: "getTokenAmountInUsd",
            tokenAddress: token.address,
            amountInUsd,
        });

        return amountInUsd;
    }
}
