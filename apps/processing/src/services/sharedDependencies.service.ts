import {
    CoreDependencies,
    InMemoryEventsRegistry,
    IStrategyRegistry,
} from "@grants-stack-indexer/data-flow";
import {
    DatabaseStrategyRegistry,
    IEventsRegistry,
    InMemoryCachedStrategyRegistry,
} from "@grants-stack-indexer/data-flow/dist/src/internal.js";
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
    KyselyStrategyRepository,
} from "@grants-stack-indexer/repository";
import { Logger } from "@grants-stack-indexer/shared";

import { Environment } from "../config/index.js";

export type SharedDependencies = {
    core: Omit<CoreDependencies, "evmProvider">;
    registries: {
        eventsRegistry: IEventsRegistry;
        strategyRegistry: IStrategyRegistry;
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

        // Initialize registries
        const eventsRegistry = new InMemoryEventsRegistry(
            new Logger({ className: "InMemoryEventsRegistry" }),
        );
        const strategyRepository = new KyselyStrategyRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );
        const strategyRegistry = await InMemoryCachedStrategyRegistry.initialize(
            new Logger({ className: "InMemoryCachedStrategyRegistry" }),
            new DatabaseStrategyRegistry(
                new Logger({ className: "DatabaseStrategyRegistry" }),
                strategyRepository,
            ),
        );

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
