import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent, StrategyEvent } from "@grants-stack-indexer/shared";

import type { IProcessor, ProcessorDependencies } from "../../internal.js";
import { UnsupportedStrategy } from "../../internal.js";
import { StrategyHandlerFactory } from "./strategyHandler.factory.js";

export class StrategyProcessor implements IProcessor<"Strategy", StrategyEvent> {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {}

    async process(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        const strategyId = event.strategyId;

        const strategyHandler = StrategyHandlerFactory.createHandler(
            this.chainId,
            this.dependencies,
            strategyId,
        );

        if (!strategyHandler) {
            throw new UnsupportedStrategy(strategyId);
        }

        return strategyHandler.handle(event);
    }
}
