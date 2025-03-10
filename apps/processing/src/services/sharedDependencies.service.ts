import { CoreDependencies } from "@grants-stack-indexer/data-flow";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { CachingMetadataProvider, MetadataProviderFactory } from "@grants-stack-indexer/metadata";
import { CachingPricingProvider, PricingProviderFactory } from "@grants-stack-indexer/pricing";
import {
    createKyselyDatabase,
    IEventRegistryRepository,
    InMemoryMetadataCache,
    InMemoryPricingCache,
    IStrategyProcessingCheckpointRepository,
    IStrategyRegistryRepository,
    KyselyApplicationPayoutRepository,
    KyselyApplicationRepository,
    KyselyAttestationRepository,
    KyselyDonationRepository,
    KyselyEventRegistryRepository,
    KyselyLegacyProjectRepository,
    KyselyMetadataCache,
    KyselyPricingCache,
    KyselyProjectRepository,
    KyselyRoundRepository,
    KyselyStrategyProcessingCheckpointRepository,
    KyselyStrategyRegistryRepository,
    KyselyTransactionManager,
} from "@grants-stack-indexer/repository";
import {
    ExponentialBackoff,
    ILogger,
    INotifier,
    Logger,
    NotifierConfig,
    NotifierFactory,
    NotifierProvider,
    RetryStrategy,
} from "@grants-stack-indexer/shared";

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
    notifier: INotifier;
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

        const notifier = NotifierFactory.create(this.getNotifierOptions(env), logger);

        // Initialize repositories
        const kyselyDatabase = createKyselyDatabase(
            {
                connectionString: env.DATABASE_URL,
                isProduction: env.NODE_ENV === "production" || env.NODE_ENV === "staging",
            },
            logger,
        );

        const transactionManager = new KyselyTransactionManager(kyselyDatabase);

        const projectRepository = new KyselyProjectRepository(kyselyDatabase, env.DATABASE_SCHEMA);
        const legacyProjectRepository = new KyselyLegacyProjectRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );
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
        const attestationRepository = new KyselyAttestationRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );
        const pricingRepository = new KyselyPricingCache(kyselyDatabase, env.DATABASE_SCHEMA);
        const internalPricingProvider = PricingProviderFactory.create(env, {
            logger,
        });
        const dbCachedPricingProvider = new CachingPricingProvider(
            internalPricingProvider,
            pricingRepository,
            logger,
        );

        const pricingProvider = new CachingPricingProvider(
            dbCachedPricingProvider,
            new InMemoryPricingCache(),
            logger,
        );

        const metadataRepository = new KyselyMetadataCache(kyselyDatabase, env.DATABASE_SCHEMA);

        const internalMetadataProvider = MetadataProviderFactory.create(env, {
            logger,
        });

        const dbCachedMetadataProvider = new CachingMetadataProvider(
            internalMetadataProvider,
            metadataRepository,
            logger,
        );
        const metadataProvider = new CachingMetadataProvider(
            dbCachedMetadataProvider,
            new InMemoryMetadataCache(),
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
                attestationRepository,
                transactionManager,
                legacyProjectRepository,
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
            notifier,
        };
    }

    private static getNotifierOptions(env: Environment): NotifierConfig<NotifierProvider> {
        if (env.NOTIFIER_PROVIDER === "slack") {
            if (!env.SLACK_WEBHOOK_URL) {
                throw new Error("SLACK_WEBHOOK_URL is required when NOTIFIER_PROVIDER is 'slack'");
            }

            return {
                notifierProvider: env.NOTIFIER_PROVIDER,
                opts: {
                    webhookUrl: env.SLACK_WEBHOOK_URL,
                },
            };
        }

        return {
            notifierProvider: "null",
        };
    }
}
