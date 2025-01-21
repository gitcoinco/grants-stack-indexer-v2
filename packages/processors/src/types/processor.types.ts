import type { EvmProvider } from "@grants-stack-indexer/chain-providers";
import type {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import { IPricingProvider } from "@grants-stack-indexer/pricing";
import { ILogger } from "@grants-stack-indexer/shared";

export type ProcessorDependencies = {
    evmProvider: EvmProvider;
    pricingProvider: IPricingProvider;
    metadataProvider: IMetadataProvider;
    roundRepository: IRoundReadRepository;
    projectRepository: IProjectReadRepository;
    applicationRepository: IApplicationReadRepository;
    logger: ILogger;
};
