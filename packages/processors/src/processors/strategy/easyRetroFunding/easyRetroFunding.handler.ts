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
import {
    calculateAmountInUsd,
    getDateFromTimestamp,
    toNumericString,
} from "../../../helpers/index.js";
import {
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
    }

    /** @inheritdoc */
    async handle(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        switch (event.eventName) {
            case "RegisteredWithSender":
                return new ERFRegisteredHandler(
                    event as ProcessorEvent<"Strategy", "RegisteredWithSender">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "UpdatedRegistrationWithStatus":
                return new ERFUpdatedRegistrationHandler(
                    event as ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "RecipientStatusUpdatedWithFullRow":
                return new BaseRecipientStatusUpdatedHandler(
                    event as ProcessorEvent<"Strategy", "RecipientStatusUpdatedWithFullRow">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "TimestampsUpdatedWithRegistrationAndAllocation":
                return new ERFTimestampsUpdatedHandler(
                    event as ProcessorEvent<
                        "Strategy",
                        "TimestampsUpdatedWithRegistrationAndAllocation"
                    >,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "DistributionUpdated":
                return new BaseDistributionUpdatedHandler(
                    event as ProcessorEvent<"Strategy", "DistributionUpdated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "FundsDistributed":
                return new BaseFundsDistributedHandler(
                    event as ProcessorEvent<"Strategy", "FundsDistributed">,
                    this.chainId,
                    this.dependencies,
                ).handle();

            default:
                throw new UnsupportedEventException("Strategy", event.eventName, this.name);
        }
    }

    /** @inheritdoc */
    override async fetchMatchAmount(
        matchingFundsAvailable: number,
        token: Token,
        blockTimestamp: TimestampMs,
    ): Promise<{ matchAmount: bigint; matchAmountInUsd: string }> {
        const matchAmount = parseUnits(toNumericString(matchingFundsAvailable), token.decimals);

        const matchAmountInUsd = await this.getTokenAmountInUsd(token, matchAmount, blockTimestamp);

        return {
            matchAmount,
            matchAmountInUsd,
        };
    }

    /** @inheritdoc */
    override async fetchStrategyTimings(strategyId: Address): Promise<StrategyTimings> {
        const { evmProvider } = this.dependencies;
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

        // TODO: refactor when evmProvider implements this natively
        if (evmProvider.getMulticall3Address()) {
            results = await evmProvider.multicall({
                contracts: contractCalls,
                allowFailure: false,
            });
        } else {
            results = (await Promise.all(
                contractCalls.map((call) =>
                    evmProvider.readContract(call.address, call.abi, call.functionName),
                ),
            )) as [bigint, bigint, bigint, bigint];
        }

        return {
            applicationsStartTime: getDateFromTimestamp(results[0]),
            applicationsEndTime: getDateFromTimestamp(results[1]),
            donationsStartTime: getDateFromTimestamp(results[2]),
            donationsEndTime: getDateFromTimestamp(results[3]),
        };
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
        const { pricingProvider } = this.dependencies;
        const tokenPrice = await pricingProvider.getTokenPrice(token.priceSourceCode, timestamp);

        if (!tokenPrice) {
            throw new TokenPriceNotFoundError(token.address, timestamp);
        }

        return calculateAmountInUsd(amount, tokenPrice.priceUsd, token.decimals);
    }
}
