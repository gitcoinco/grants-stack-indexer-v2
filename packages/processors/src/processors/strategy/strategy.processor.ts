import { Changeset } from "@grants-stack-indexer/repository";
import { ChainId, ProcessorEvent, StrategyEvent } from "@grants-stack-indexer/shared";

import type { IProcessor, ProcessorDependencies } from "../../internal.js";
import { getHandler, UnsupportedStrategy } from "../../internal.js";
import { StrategyHandlerFactory } from "./strategyHandler.factory.js";

export class StrategyProcessor implements IProcessor<"Strategy", StrategyEvent> {
    constructor(
        private readonly chainId: ChainId,
        private readonly dependencies: ProcessorDependencies,
    ) {
        this.dependencies.logger?.debug("Initializing StrategyProcessor", {
            className: "StrategyProcessor",
            chainId: this.chainId,
        });
    }

    async process(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]> {
        const { logger } = this.dependencies;
        const strategyId = event.strategyId;

        logger?.debug("Starting strategy event processing", {
            className: "StrategyProcessor",
            methodName: "process",
            eventName: event.eventName,
            strategyId: getHandler(strategyId),
            chainId: this.chainId,
            blockNumber: event.blockNumber,
        });

        try {
            logger?.debug("Creating strategy handler", {
                className: "StrategyProcessor",
                methodName: "process",
                strategyId: getHandler(strategyId),
                chainId: this.chainId,
            });

            const strategyHandler = StrategyHandlerFactory.createHandler(
                this.chainId,
                this.dependencies,
                strategyId,
            );

            if (!strategyHandler) {
                logger?.error("Unsupported strategy encountered", {
                    className: "StrategyProcessor",
                    methodName: "process",
                    strategyId: getHandler(strategyId),
                    chainId: this.chainId,
                });
                throw new UnsupportedStrategy(strategyId);
            }

            logger?.debug("Delegating to strategy handler", {
                className: "StrategyProcessor",
                methodName: "process",
                strategyId: getHandler(strategyId),
                handlerType: strategyHandler.constructor.name,
            });

            const result = await strategyHandler.handle(event);

            logger?.info("Strategy event processing completed", {
                className: "StrategyProcessor",
                methodName: "process",
                strategyId: getHandler(strategyId),
                eventName: event.eventName,
                chainId: this.chainId,
                changesetCount: result.length,
            });

            return result;
        } catch (error) {
            logger?.error("Error processing strategy event", {
                className: "StrategyProcessor",
                methodName: "process",
                strategyId: getHandler(strategyId),
                eventName: event.eventName,
                chainId: this.chainId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
