import { Hex } from "viem";

import { NonRetriableError } from "@grants-stack-indexer/shared";

export class UnsupportedStrategy extends NonRetriableError {
    constructor(strategyId: Hex) {
        super(`Strategy ${strategyId} unsupported`);
    }
}
