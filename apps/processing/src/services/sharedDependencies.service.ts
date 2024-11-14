import {
    CoreDependencies,
    InMemoryEventsRegistry,
    InMemoryStrategyRegistry,
} from "@grants-stack-indexer/data-flow";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IpfsProvider } from "@grants-stack-indexer/metadata";
import { PricingProviderFactory } from "@grants-stack-indexer/pricing";
import {
    createKyselyDatabase,
    KyselyApplicationPayoutRepository,
    KyselyApplicationRepository,
    KyselyDonationRepository,
    KyselyProjectRepository,
    KyselyRoundRepository,
} from "@grants-stack-indexer/repository";
import { ILogger } from "@grants-stack-indexer/shared";

import { Environment } from "../config/index.js";

export type SharedDependencies = {
    core: Omit<CoreDependencies, "evmProvider">;
    registries: {
        eventsRegistry: InMemoryEventsRegistry;
        strategyRegistry: InMemoryStrategyRegistry;
    };
    indexerClient: EnvioIndexerClient;
    kyselyDatabase: ReturnType<typeof createKyselyDatabase>;
};

/**
 * Shared dependencies service
 * - Initializes core dependencies (repositories, providers)
 * - Initializes registries
 * - Initializes indexer client
 */
export class SharedDependenciesService {
    static initialize(env: Environment, logger: ILogger): SharedDependencies {
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
        const pricingProvider = PricingProviderFactory.create(env, { logger });

        const metadataProvider = new IpfsProvider(env.IPFS_GATEWAYS_URL, logger);

        // Initialize registries
        const eventsRegistry = new InMemoryEventsRegistry(logger);
        const strategyRegistry = new InMemoryStrategyRegistry(logger);

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
            registries: {
                eventsRegistry,
                strategyRegistry,
            },
            indexerClient,
            kyselyDatabase,
        };
    }
}
