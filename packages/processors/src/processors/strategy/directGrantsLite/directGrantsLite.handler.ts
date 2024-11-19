import { Changeset } from "@grants-stack-indexer/repository";
import { Address, ChainId, ProcessorEvent, StrategyEvent } from "@grants-stack-indexer/shared";

import DirectGrantsLiteStrategy from "../../../abis/allo-v2/v1/DirectGrantsLiteStrategy.js";
import { getDateFromTimestamp } from "../../../helpers/index.js";
import {
    BaseRecipientStatusUpdatedHandler,
    ProcessorDependencies,
    StrategyTimings,
    UnsupportedEventException,
} from "../../../internal.js";
import { BaseStrategyHandler } from "../index.js";
import {
    DGLiteAllocatedHandler,
    DGLiteRegisteredHandler,
    DGLiteTimestampsUpdatedHandler,
    DGLiteUpdatedRegistrationHandler,
} from "./handlers/index.js";

const STRATEGY_NAME = "allov2.DirectGrantsLiteStrategy";

/**
 * This handler is responsible for processing events related to the
 * Direct Grants Lite strategy.
 *
 * The following events are currently handled by this strategy:
 * - Registered
 * - UpdatedRegistrationWithStatus
 * - TimestampsUpdated
 * - AllocatedWithToken
 * - RecipientStatusUpdatedWithFullRow
 */
export class DirectGrantsLiteStrategyHandler extends BaseStrategyHandler {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {
        super(STRATEGY_NAME);
    }

    /** @inheritdoc */
    async handle(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        switch (event.eventName) {
            case "RecipientStatusUpdatedWithFullRow":
                return new BaseRecipientStatusUpdatedHandler(
                    event as ProcessorEvent<"Strategy", "RecipientStatusUpdatedWithFullRow">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "RegisteredWithSender":
                return new DGLiteRegisteredHandler(
                    event as ProcessorEvent<"Strategy", "RegisteredWithSender">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "UpdatedRegistrationWithStatus":
                return new DGLiteUpdatedRegistrationHandler(
                    event as ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "TimestampsUpdated":
                return new DGLiteTimestampsUpdatedHandler(
                    event as ProcessorEvent<"Strategy", "TimestampsUpdated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "AllocatedWithToken":
                return new DGLiteAllocatedHandler(
                    event as ProcessorEvent<"Strategy", "AllocatedWithToken">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            default:
                throw new UnsupportedEventException("Strategy", event.eventName, this.name);
        }
    }

    /** @inheritdoc */
    override async fetchStrategyTimings(strategyId: Address): Promise<StrategyTimings> {
        const { evmProvider } = this.dependencies;
        let results: [bigint, bigint] = [0n, 0n];

        const contractCalls = [
            {
                abi: DirectGrantsLiteStrategy,
                functionName: "registrationStartTime",
                address: strategyId,
            },
            {
                abi: DirectGrantsLiteStrategy,
                functionName: "registrationEndTime",
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
            )) as [bigint, bigint];
        }

        return {
            applicationsStartTime: getDateFromTimestamp(results[0]),
            applicationsEndTime: getDateFromTimestamp(results[1]),
            donationsStartTime: null,
            donationsEndTime: null,
        };
    }
}
