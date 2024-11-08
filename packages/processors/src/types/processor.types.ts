import type { EvmProvider } from "@grants-stack-indexer/chain-providers";
import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type { IPricingProvider } from "@grants-stack-indexer/pricing";
import type {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";

export type ProcessorDependencies = {
    evmProvider: EvmProvider;
    pricingProvider: IPricingProvider;
    metadataProvider: IMetadataProvider;
    roundRepository: IRoundReadRepository;
    projectRepository: IProjectReadRepository;
    applicationRepository: IApplicationReadRepository;
};
