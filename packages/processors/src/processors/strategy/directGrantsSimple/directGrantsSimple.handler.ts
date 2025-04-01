import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent, StrategyEvent } from "@grants-stack-indexer/shared";

import { ProcessorDependencies, UnsupportedEventException } from "../../../internal.js";
import { BaseDistributedHandler, BaseStrategyHandler } from "../index.js";
import { DGSimpleRegisteredHandler, DGSimpleTimestampsUpdatedHandler } from "./handlers/index.js";

const STRATEGY_NAME = "allov2.DirectGrantsSimpleStrategy";

/**
 * This handler is responsible for processing events related to the
 * Direct Grants Simple strategy.
 *
 * The following events are currently handled by this strategy:
 * - TimestampsUpdated
 * - RegisteredWithSender
 * - DistributedWithRecipientAddress
 */
export class DGSimpleStrategyHandler extends BaseStrategyHandler {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {
        super(STRATEGY_NAME);
        this.dependencies.logger?.debug("Initializing DGSimpleStrategyHandler", {
            className: "DGSimpleStrategyHandler",
            chainId: this.chainId,
            strategyName: STRATEGY_NAME,
        });
    }

    /** @inheritdoc */
    async handle(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        const { logger } = this.dependencies;

        logger?.debug("Processing strategy event", {
            className: "DGSimpleStrategyHandler",
            methodName: "handle",
            eventName: event.eventName,
            strategyAddress: event.srcAddress,
            blockNumber: event.blockNumber,
        });

        try {
            let result: Changeset[];
            switch (event.eventName) {
                case "TimestampsUpdated":
                    logger?.debug("Delegating to DGSimpleTimestampsUpdatedHandler", {
                        className: "DGSimpleStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new DGSimpleTimestampsUpdatedHandler(
                        event as ProcessorEvent<"Strategy", "TimestampsUpdated">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "RegisteredWithSender":
                    logger?.debug("Delegating to DGSimpleRegisteredHandler", {
                        className: "DGSimpleStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new DGSimpleRegisteredHandler(
                        event as ProcessorEvent<"Strategy", "RegisteredWithSender">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                case "DistributedWithRecipientAddress":
                    logger?.debug("Delegating to BaseDistributedHandler", {
                        className: "DGSimpleStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                    });
                    result = await new BaseDistributedHandler(
                        event as ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">,
                        this.chainId,
                        this.dependencies,
                    ).handle();
                    break;

                default:
                    logger?.warn("Unsupported event received", {
                        className: "DGSimpleStrategyHandler",
                        methodName: "handle",
                        eventName: event.eventName,
                        strategyName: this.name,
                    });
                    throw new UnsupportedEventException("Strategy", event.eventName, this.name);
            }

            logger?.debug("Event processing completed", {
                className: "DGSimpleStrategyHandler",
                methodName: "handle",
                eventName: event.eventName,
                changeCount: result.length,
            });

            return result;
        } catch (error) {
            logger?.error("Error processing event", {
                className: "DGSimpleStrategyHandler",
                methodName: "handle",
                eventName: event.eventName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
