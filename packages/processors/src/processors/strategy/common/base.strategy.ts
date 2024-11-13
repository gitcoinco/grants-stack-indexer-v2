import { Changeset } from "@grants-stack-indexer/repository";
import { Address, ProcessorEvent, StrategyEvent, Token } from "@grants-stack-indexer/shared";

import { IStrategyHandler, StrategyTimings } from "../../../internal.js";

/**
 * @abstract
 * Base class for all strategy handlers.
 *
 * Implementations of this class should be named like `<StrategyName>StrategyHandler`.
 *
 */
export abstract class BaseStrategyHandler implements IStrategyHandler<StrategyEvent> {
    readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    /** @inheritdoc */
    async fetchStrategyTimings(_strategyAddress: Address): Promise<StrategyTimings> {
        return {
            applicationsStartTime: null,
            applicationsEndTime: null,
            donationsStartTime: null,
            donationsEndTime: null,
        };
    }

    /** @inheritdoc */
    async fetchMatchAmount(
        _matchingFundsAvailable: number,
        _token: Token,
        _blockTimestamp: number,
    ): Promise<{ matchAmount: bigint; matchAmountInUsd: string }> {
        return {
            matchAmount: 0n,
            matchAmountInUsd: "0",
        };
    }

    abstract handle(event: ProcessorEvent<"Strategy", StrategyEvent>): Promise<Changeset[]>;
}
