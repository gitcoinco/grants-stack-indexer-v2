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
export class DirectGrantsSimpleStrategyHandler extends BaseStrategyHandler {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {
        super(STRATEGY_NAME);
    }

    /** @inheritdoc */
    async handle(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        switch (event.eventName) {
            case "TimestampsUpdated":
                return new DGSimpleTimestampsUpdatedHandler(
                    event as ProcessorEvent<"Strategy", "TimestampsUpdated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "RegisteredWithSender":
                return new DGSimpleRegisteredHandler(
                    event as ProcessorEvent<"Strategy", "RegisteredWithSender">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            case "DistributedWithRecipientAddress":
                return new BaseDistributedHandler(
                    event as ProcessorEvent<"Strategy", "DistributedWithRecipientAddress">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            default:
                throw new UnsupportedEventException("Strategy", event.eventName, this.name);
        }
    }
}
