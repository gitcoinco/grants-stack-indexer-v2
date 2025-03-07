import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import { ProcessorDependencies } from "@grants-stack-indexer/processors";
import {
    IApplicationPayoutRepository,
    IApplicationRepository,
    IAttestationRepository,
    ICache,
    IDonationRepository,
    ILegacyProjectRepository,
    IProjectRepository,
    IRoundRepository,
    ITransactionManager,
    StrategyTimings,
} from "@grants-stack-indexer/repository";
import { Address, ICacheable } from "@grants-stack-indexer/shared";

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
    pricingProvider: IPricingProvider & Partial<ICacheable>;
    metadataProvider: IMetadataProvider & Partial<ICacheable>;
    roundRepository: IRoundRepository;
    projectRepository: IProjectRepository;
    applicationRepository: IApplicationRepository;
    donationRepository: IDonationRepository;
    applicationPayoutRepository: IApplicationPayoutRepository;
    attestationRepository: IAttestationRepository;
    transactionManager: ITransactionManager;
    legacyProjectRepository: ILegacyProjectRepository;
    strategyTimingsRepository: ICache<Address, StrategyTimings>;
};
