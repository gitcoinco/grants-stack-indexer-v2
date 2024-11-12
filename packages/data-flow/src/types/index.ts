import { ProcessorDependencies } from "@grants-stack-indexer/processors";
import {
    Changeset,
    IApplicationRepository,
    IDonationRepository,
    IProjectRepository,
    IRoundRepository,
} from "@grants-stack-indexer/repository";

/**
 * The result of the execution of the changesets.
 */
export type ExecutionResult = {
    changesets: Changeset["type"][];
    numExecuted: number;
    numSuccessful: number;
    numFailed: number;
    errors: string[];
};

/**
 * The core dependencies for the data flow
 *
 * Note: for Repositories, we type the Read & Write interfaces
 * while the ProcessorDependencies type uses the ReadOnly interfaces
 * so that's why we need this type
 */
export type CoreDependencies = Pick<
    ProcessorDependencies,
    "evmProvider" | "pricingProvider" | "metadataProvider"
> & {
    roundRepository: IRoundRepository;
    projectRepository: IProjectRepository;
    applicationRepository: IApplicationRepository;
    donationRepository: IDonationRepository;
};
