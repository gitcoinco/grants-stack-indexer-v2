import { ContractName, NonRetriableError } from "@grants-stack-indexer/shared";

export class UnsupportedEventException extends NonRetriableError {
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
