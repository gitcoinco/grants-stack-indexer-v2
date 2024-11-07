import {
    CoreDependencies,
    InMemoryEventsRegistry,
    InMemoryStrategyRegistry,
} from "@grants-stack-indexer/data-flow";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IpfsProvider } from "@grants-stack-indexer/metadata";
import { CoingeckoProvider } from "@grants-stack-indexer/pricing";
import {
    createKyselyDatabase,
    KyselyApplicationRepository,
    KyselyDonationRepository,
    KyselyProjectRepository,
    KyselyRoundRepository,
} from "@grants-stack-indexer/repository";

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
    static initialize(env: Environment): SharedDependencies {
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
        const pricingProvider = new CoingeckoProvider({
            apiKey: env.COINGECKO_API_KEY,
            apiType: env.COINGECKO_API_TYPE,
        });

        const metadataProvider = new IpfsProvider(env.IPFS_GATEWAYS_URL);

        // Initialize registries
        const eventsRegistry = new InMemoryEventsRegistry();
        const strategyRegistry = new InMemoryStrategyRegistry();

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
