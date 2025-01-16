import type { EvmProvider } from "@grants-stack-indexer/chain-providers";
import type { ICacheableMetadataProvider } from "@grants-stack-indexer/metadata";
import type { ICacheablePricingProvider } from "@grants-stack-indexer/pricing";
import type {
    IApplicationReadRepository,
    IProjectReadRepository,
    IRoundReadRepository,
} from "@grants-stack-indexer/repository";
import { ILogger } from "@grants-stack-indexer/shared";

export type ProcessorDependencies = {
    evmProvider: EvmProvider;
    pricingProvider: ICacheablePricingProvider;
    metadataProvider: ICacheableMetadataProvider;
    roundRepository: IRoundReadRepository;
    projectRepository: IProjectReadRepository;
    applicationRepository: IApplicationReadRepository;
    logger: ILogger;
};
