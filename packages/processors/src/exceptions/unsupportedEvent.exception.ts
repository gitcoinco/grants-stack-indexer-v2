import { ContractName } from "@grants-stack-indexer/shared";

export class UnsupportedEventException extends Error {
    constructor(
        contract: ContractName,
        public readonly eventName: string,
        strategyName?: string,
    ) {
        super(
            `Event ${eventName} unsupported for ${contract} processor${strategyName ? `, strategy ${strategyName}` : ""}`,
        );
    }
}
