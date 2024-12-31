import { ProcessorDependencies } from "@grants-stack-indexer/processors";
import {
    IApplicationPayoutRepository,
    IApplicationRepository,
    IDonationRepository,
    IProjectRepository,
    IRoundRepository,
    ITransactionManager,
} from "@grants-stack-indexer/repository";

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
    applicationPayoutRepository: IApplicationPayoutRepository;
    transactionManager: ITransactionManager;
};
