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
import { BaseStrategyHandler, getHandler } from "../index.js";
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
        this.dependencies.logger?.debug("Initializing DirectGrantsLiteStrategyHandler", {
            className: "DirectGrantsLiteStrategyHandler",
            chainId: this.chainId,
            strategyName: STRATEGY_NAME,
        });
    }

    /** @inheritdoc */
    async handle(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        const { logger } = this.dependencies;

        logger?.debug("Processing strategy event", {
            className: "DirectGrantsLiteStrategyHandler",
            methodName: "handle",
            eventName: event.eventName,
            strategyAddress: event.srcAddress,
            blockNumber: event.blockNumber,
        });

        try {
            let result: Changeset[];
            switch (event.eventName) {
                case "RecipientStatusUpdatedWithFullRow":
                    logger?.debug("Delegating to BaseRecipientStatusUpdatedHandler", {
                        className: "DirectGrantsLiteStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new BaseRecipientStatusUpdatedHandler(
                        event as ProcessorEvent<"Strategy", "RecipientStatusUpdatedWithFullRow">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "RegisteredWithSender":
                    logger?.debug("Delegating to DGLiteRegisteredHandler", {
                        className: "DirectGrantsLiteStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new DGLiteRegisteredHandler(
                        event as ProcessorEvent<"Strategy", "RegisteredWithSender">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "UpdatedRegistrationWithStatus":
                    logger?.debug("Delegating to DGLiteUpdatedRegistrationHandler", {
                        className: "DirectGrantsLiteStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new DGLiteUpdatedRegistrationHandler(
                        event as ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "TimestampsUpdated":
                    logger?.debug("Delegating to DGLiteTimestampsUpdatedHandler", {
                        className: "DirectGrantsLiteStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new DGLiteTimestampsUpdatedHandler(
                        event as ProcessorEvent<"Strategy", "TimestampsUpdated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                case "AllocatedWithToken":
                    logger?.debug("Delegating to DGLiteAllocatedHandler", {
                        className: "DirectGrantsLiteStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new DGLiteAllocatedHandler(
                        event as ProcessorEvent<"Strategy", "AllocatedWithToken">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;
                default:
                    logger?.warn("Unsupported event received", {
                        className: "DirectGrantsLiteStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                        strategyName: this.name,
                    });
                    throw new UnsupportedEventException("Strategy", event.eventName, this.name);
            }

            logger?.debug("Event processing completed", {
                className: "DirectGrantsLiteStrategyHandler",
                methodName: "handle",
                eventName: event.eventName,
                changeCount: result.length,
            });

            return result;
        } catch (error) {
            logger?.error("Error processing event", {
                className: "DirectGrantsLiteStrategyHandler",
                methodName: "handle",
                eventName: event.eventName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /** @inheritdoc */
    override async fetchStrategyTimings(strategyId: Address): Promise<StrategyTimings> {
        const { evmProvider, logger } = this.dependencies;

        logger?.debug("Fetching strategy timings", {
            className: "DirectGrantsLiteStrategyHandler",
            methodName: "fetchStrategyTimings",
            strategyId: getHandler(strategyId),
            chainId: this.chainId,
        });

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

        try {
            if (evmProvider.getMulticall3Address()) {
                logger?.debug("Using multicall for fetching timings", {
                    className: "DirectGrantsLiteStrategyHandler",
                    methodName: "fetchStrategyTimings",
                    multicallAddress: evmProvider.getMulticall3Address(),
                });

                results = await evmProvider.multicall({
                    contracts: contractCalls,
                    allowFailure: false,
                });
            } else {
                logger?.debug("Using individual calls for fetching timings", {
                    className: "DirectGrantsLiteStrategyHandler",
                    methodName: "fetchStrategyTimings",
                });

                results = (await Promise.all(
                    contractCalls.map((call) =>
                        evmProvider.readContract(call.address, call.abi, call.functionName),
                    ),
                )) as [bigint, bigint];
            }

            const timings = {
                applicationsStartTime: getDateFromTimestamp(results[0]),
                applicationsEndTime: getDateFromTimestamp(results[1]),
                donationsStartTime: null,
                donationsEndTime: null,
            };

            logger?.debug("Strategy timings fetched", {
                className: "DirectGrantsLiteStrategyHandler",
                methodName: "fetchStrategyTimings",
                strategyId: getHandler(strategyId),
                startTime: timings.applicationsStartTime?.toISOString(),
                endTime: timings.applicationsEndTime?.toISOString(),
            });

            return timings;
        } catch (error) {
            logger?.error("Error fetching strategy timings", {
                className: "DirectGrantsLiteStrategyHandler",
                methodName: "fetchStrategyTimings",
                strategyId: getHandler(strategyId),
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
