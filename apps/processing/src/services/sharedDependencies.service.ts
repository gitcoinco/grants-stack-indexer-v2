import { CoreDependencies } from "@grants-stack-indexer/data-flow";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { CachingMetadataProvider, IpfsProvider } from "@grants-stack-indexer/metadata";
import { CachingPricingProvider, PricingProviderFactory } from "@grants-stack-indexer/pricing";
import {
    createKyselyDatabase,
    IEventRegistryRepository,
    IStrategyProcessingCheckpointRepository,
    IStrategyRegistryRepository,
    KyselyApplicationPayoutRepository,
    KyselyApplicationRepository,
    KyselyDonationRepository,
    KyselyEventRegistryRepository,
    KyselyMetadataCache,
    KyselyPricingCache,
    KyselyProjectRepository,
    KyselyRoundRepository,
    KyselyStrategyProcessingCheckpointRepository,
    KyselyStrategyRegistryRepository,
    KyselyTransactionManager,
} from "@grants-stack-indexer/repository";
import { ExponentialBackoff, ILogger, Logger, RetryStrategy } from "@grants-stack-indexer/shared";

import { Environment } from "../config/index.js";

export type SharedDependencies = {
    core: Omit<CoreDependencies, "evmProvider">;
    registriesRepositories: {
        eventRegistryRepository: IEventRegistryRepository;
        strategyRegistryRepository: IStrategyRegistryRepository;
        strategyProcessingCheckpointRepository: IStrategyProcessingCheckpointRepository;
    };
    indexerClient: EnvioIndexerClient;
    kyselyDatabase: ReturnType<typeof createKyselyDatabase>;
    retryStrategy: RetryStrategy;
    logger: ILogger;
};

/**
 * Shared dependencies service
 * - Initializes core dependencies (repositories, providers)
 * - Initializes registries repositories
 * - Initializes indexer client
 */
export class SharedDependenciesService {
    static async initialize(env: Environment): Promise<SharedDependencies> {
        const logger = Logger.getInstance();

        // Initialize repositories
        const kyselyDatabase = createKyselyDatabase(
            {
                connectionString: env.DATABASE_URL,
            },
            logger,
        );

        const transactionManager = new KyselyTransactionManager(kyselyDatabase);

        const projectRepository = new KyselyProjectRepository(kyselyDatabase, env.DATABASE_SCHEMA);
        const roundRepository = new KyselyRoundRepository(kyselyDatabase, env.DATABASE_SCHEMA);
        const applicationRepository = new KyselyApplicationRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );
        const donationRepository = new KyselyDonationRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );
        const applicationPayoutRepository = new KyselyApplicationPayoutRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );
        const pricingRepository = new KyselyPricingCache(kyselyDatabase, env.DATABASE_SCHEMA);
        const _pricingProvider = PricingProviderFactory.create(env, {
            logger,
        });
        const pricingProvider = new CachingPricingProvider(
            _pricingProvider,
            pricingRepository,
            logger,
        );

        const metadataRepository = new KyselyMetadataCache(kyselyDatabase, env.DATABASE_SCHEMA);
        const _metadataProvider = new IpfsProvider(env.IPFS_GATEWAYS_URL, logger);
        const metadataProvider = new CachingMetadataProvider(
            _metadataProvider,
            metadataRepository,
            logger,
        );

        const eventRegistryRepository = new KyselyEventRegistryRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );
        const strategyRegistryRepository = new KyselyStrategyRegistryRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );

        const strategyProcessingCheckpointRepository =
            new KyselyStrategyProcessingCheckpointRepository(kyselyDatabase, env.DATABASE_SCHEMA);

        // Initialize indexer client
        const indexerClient = new EnvioIndexerClient(
            env.INDEXER_GRAPHQL_URL,
            env.INDEXER_ADMIN_SECRET,
        );

        const retryStrategy = new ExponentialBackoff({
            maxAttempts: env.RETRY_MAX_ATTEMPTS,
            baseDelay: env.RETRY_BASE_DELAY_MS,
            maxDelay: env.RETRY_MAX_DELAY_MS,
            factor: env.RETRY_FACTOR,
        });

        return {
            core: {
                projectRepository,
                roundRepository,
                applicationRepository,
                pricingProvider,
                donationRepository,
                metadataProvider,
                applicationPayoutRepository,
                transactionManager,
            },
            registriesRepositories: {
                eventRegistryRepository,
                strategyRegistryRepository,
                strategyProcessingCheckpointRepository,
            },
            indexerClient,
            kyselyDatabase,
            retryStrategy,
            logger,
        };
    }
}
