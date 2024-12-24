import { CoreDependencies } from "@grants-stack-indexer/data-flow";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IpfsProvider } from "@grants-stack-indexer/metadata";
import { PricingProviderFactory } from "@grants-stack-indexer/pricing";
import {
    createKyselyDatabase,
    IEventRegistryRepository,
    IStrategyProcessingCheckpointRepository,
    IStrategyRegistryRepository,
    KyselyApplicationPayoutRepository,
    KyselyApplicationRepository,
    KyselyDonationRepository,
    KyselyEventRegistryRepository,
    KyselyProjectRepository,
    KyselyRoundRepository,
    KyselyStrategyProcessingCheckpointRepository,
    KyselyStrategyRegistryRepository,
} from "@grants-stack-indexer/repository";
import { Logger } from "@grants-stack-indexer/shared";

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
};

/**
 * Shared dependencies service
 * - Initializes core dependencies (repositories, providers)
 * - Initializes registries repositories
 * - Initializes indexer client
 */
export class SharedDependenciesService {
    static async initialize(env: Environment): Promise<SharedDependencies> {
        // Initialize repositories
        const kyselyDatabase = createKyselyDatabase({
            connectionString: env.DATABASE_URL,
        });

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
        const pricingProvider = PricingProviderFactory.create(env, {
            logger: new Logger({ className: "PricingProvider" }),
        });

        const metadataProvider = new IpfsProvider(
            env.IPFS_GATEWAYS_URL,
            new Logger({ className: "IpfsProvider" }),
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

        return {
            core: {
                projectRepository,
                roundRepository,
                applicationRepository,
                pricingProvider,
                donationRepository,
                metadataProvider,
                applicationPayoutRepository,
            },
            registriesRepositories: {
                eventRegistryRepository,
                strategyRegistryRepository,
                strategyProcessingCheckpointRepository,
            },
            indexerClient,
            kyselyDatabase,
        };
    }
}
