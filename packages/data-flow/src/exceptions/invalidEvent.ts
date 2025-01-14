import {
    AnyEvent,
    ContractName,
    NonRetriableError,
    ProcessorEvent,
    stringify,
} from "@grants-stack-indexer/shared";

export class InvalidEvent extends NonRetriableError {
    constructor(event: ProcessorEvent<ContractName, AnyEvent>) {
        super(`Event couldn't be processed: ${stringify(event)}`);

        this.name = "InvalidEvent";
    }
}
