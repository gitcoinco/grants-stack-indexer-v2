import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent, StrategyEvent } from "@grants-stack-indexer/shared";

import { ProcessorDependencies, UnsupportedEventException } from "../../../internal.js";
import { BaseStrategyHandler } from "../index.js";
import { DirectAllocatedHandler } from "./handlers/index.js";

const STRATEGY_NAME = "allov2.DirectAllocationStrategy";

/**
 * This handler is responsible for processing events related to the
 * Direct Allocation strategy.
 *
 * The following events are currently handled by this strategy:
 * - DirectAllocated
 */
export class DirectAllocationStrategyHandler extends BaseStrategyHandler {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {
        super(STRATEGY_NAME);
    }

    /** @inheritdoc */
    async handle(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        switch (event.eventName) {
            case "DirectAllocated":
                return new DirectAllocatedHandler(
                    event as ProcessorEvent<"Strategy", "DirectAllocated">,
                    this.chainId,
                    this.dependencies,
                ).handle();
            default:
                throw new UnsupportedEventException("Strategy", event.eventName);
        }
    }
}
