import type { Changeset } from "@grants-stack-indexer/repository";
import {
    AlloProcessor,
    AlloV1ToV2ProfileMigrationProcessor,
    ProcessorDependencies,
    RegistryProcessor,
    StrategyProcessor,
} from "@grants-stack-indexer/processors";
import {
    AnyEvent,
    ChainId,
    ContractName,
    isAlloEvent,
    isAlloV1ToV2ProfileMigrationEvent,
    isRegistryEvent,
    isStrategyEvent,
    ProcessorEvent,
} from "@grants-stack-indexer/shared";

import { InvalidEvent } from "./exceptions/index.js";

/**
 * EventsProcessor handles the processing of Allo V2 events by delegating them to the appropriate processor
 * (Allo, Registry, or Strategy) based on the event type. Each processor generates changesets that represent
 * the required database updates.
 */
export class EventsProcessor {
    alloProcessor: AlloProcessor;
    registryProcessor: RegistryProcessor;
    strategyProcessor: StrategyProcessor;
    alloV1ToV2MigrationProcessor: AlloV1ToV2ProfileMigrationProcessor;

    constructor(chainId: ChainId, dependencies: Readonly<ProcessorDependencies>) {
        this.alloProcessor = new AlloProcessor(chainId, dependencies);
        this.registryProcessor = new RegistryProcessor(chainId, dependencies);
        this.strategyProcessor = new StrategyProcessor(chainId, dependencies);
        this.alloV1ToV2MigrationProcessor = new AlloV1ToV2ProfileMigrationProcessor(
            chainId,
            dependencies,
        );
    }

    /**
     * Process an Allo V2 event and return the changesets
     * @param event - The event to process
     * @returns The changesets
     * @throws InvalidEvent if the event is not a valid Allo V2 event (Allo, Registry or Strategy)
     */
    public async processEvent(event: ProcessorEvent<ContractName, AnyEvent>): Promise<Changeset[]> {
        if (isAlloEvent(event)) {
            return await this.alloProcessor.process(event);
        }
        if (isRegistryEvent(event)) {
            return await this.registryProcessor.process(event);
        }
        if (isStrategyEvent(event)) {
            return await this.strategyProcessor.process(event);
        }
        if (isAlloV1ToV2ProfileMigrationEvent(event)) {
            return await this.alloV1ToV2MigrationProcessor.process(event);
        }

        throw new InvalidEvent(event);
    }
}
